package main

import (
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	maxUploadSize = 60 << 20 // 60 MB
	fileTTL       = 5 * time.Minute
)

type FileEntry struct {
	FilePath     string
	OriginalName string
	CreatedAt    time.Time
}

var (
	fileMap = make(map[string]FileEntry)
	mu      sync.Mutex
	authKey = os.Getenv("AUTH_KEY")
)

func isAuthorized(r *http.Request) bool {
	if authKey == "" {
		return true // Open mode: no key set, anyone can use
	}
	if r.Header.Get("X-Auth-Key") == authKey {
		return true
	}
	if r.URL.Query().Get("auth") == authKey {
		return true
	}
	return false
}

func generatePin() string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

func startCleanupWorker() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		mu.Lock()
		now := time.Now()
		for pin, entry := range fileMap {
			if now.Sub(entry.CreatedAt) > fileTTL {
				_ = os.Remove(entry.FilePath)
				delete(fileMap, pin)
			}
		}
		mu.Unlock()
	}
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !isAuthorized(r) {
		http.Error(w, "Unauthorized: Invalid or missing server access key", http.StatusUnauthorized)
		return
	}

	// Enforce 60 MB limit
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	rawName := r.Header.Get("X-File-Name")
	decodedName, err := url.QueryUnescape(rawName)
	if err != nil || decodedName == "" {
		decodedName = "file.dat"
	}
	filename := filepath.Base(decodedName) // Prevent path traversal

	pin := strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Session-Pin")))
	mu.Lock()
	if len(pin) != 4 {
		for {
			pin = generatePin()
			if _, exists := fileMap[pin]; !exists {
				break
			}
		}
	}
	mu.Unlock()

	savePath := filepath.Join("uploads", fmt.Sprintf("%s_%s", pin, filename))
	outFile, err := os.Create(savePath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}

	// Stream directly to disk before registering the PIN as ready
	if _, err := io.Copy(outFile, r.Body); err != nil {
		outFile.Close()
		_ = os.Remove(savePath)
		http.Error(w, "Upload failed or exceeded 60MB limit", http.StatusRequestEntityTooLarge)
		return
	}
	outFile.Close()

	// Register file only after upload completes so desktop polling doesn't trigger early
	mu.Lock()
	fileMap[pin] = FileEntry{
		FilePath:     savePath,
		OriginalName: filename,
		CreatedAt:    time.Now(),
	}
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"pin":"%s"}`, pin)
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	pin := strings.ToUpper(strings.TrimSpace(r.URL.Path[len("/api/status/"):]))
	mu.Lock()
	entry, exists := fileMap[pin]
	mu.Unlock()

	if !exists {
		http.Error(w, "Not ready", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"ready":true,"filename":"%s"}`, entry.OriginalName)
}

// relayHandler bridges/forwards a file from one PIN to another PIN (e.g. Phone bridges Laptop A to Laptop B)
func relayHandler(w http.ResponseWriter, r *http.Request) {
	if !isAuthorized(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	from := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("from")))
	to := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("to")))

	if len(from) != 4 || len(to) != 4 {
		http.Error(w, "Invalid PIN length (must be 4 characters)", http.StatusBadRequest)
		return
	}

	mu.Lock()
	entry, exists := fileMap[from]
	if !exists {
		mu.Unlock()
		http.Error(w, "Source file not found or expired", http.StatusNotFound)
		return
	}

	// Bridge file entry to target PIN
	fileMap[to] = entry
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"success":true,"filename":"%s","pin":"%s"}`, entry.OriginalName, to)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !isAuthorized(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	pin := strings.ToUpper(strings.TrimSpace(r.URL.Path[len("/api/download/"):]))

	mu.Lock()
	entry, exists := fileMap[pin]
	if exists {
		// Burn all PIN references to this file after reading
		filePath := entry.FilePath
		for p, e := range fileMap {
			if e.FilePath == filePath {
				delete(fileMap, p)
			}
		}
	}
	mu.Unlock()

	if !exists {
		http.Error(w, "PIN not found or expired", http.StatusNotFound)
		return
	}

	file, err := os.Open(entry.FilePath)
	if err != nil {
		http.Error(w, "File missing on disk", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, entry.OriginalName))
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = io.Copy(w, file)
	file.Close()

	_ = os.Remove(entry.FilePath) // Delete from disk immediately
}

func main() {
	_ = os.MkdirAll("uploads", 0755)
	go startCleanupWorker()

	http.Handle("/", http.FileServer(http.Dir("./public")))
	http.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"authRequired":%t}`, authKey != "")
	})
	http.HandleFunc("/api/upload", uploadHandler)
	http.HandleFunc("/api/status/", statusHandler)
	http.HandleFunc("/api/relay", relayHandler)
	http.HandleFunc("/api/download/", downloadHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server listening on http://0.0.0.0:%s\n", port)
	if authKey != "" {
		fmt.Println("Server authentication ENABLED (AUTH_KEY set)")
	} else {
		fmt.Println("Server authentication DISABLED (Open public mode)")
	}
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		fmt.Println("Server error:", err)
	}
}
