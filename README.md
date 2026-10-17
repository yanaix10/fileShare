# fileShare ⚡

A fast, lightweight, and ephemeral peer-to-peer style file sharing web application built with **Go** and **Vanilla JS**. Transfer photos, documents, and files seamlessly between your computer and mobile phone using 4-character PINs and QR codes.

No accounts. No app installation. Files burn immediately upon download or after 5 minutes.

---

## ✨ Features

- 📱 **QR Code Transfer**: Scan a QR code on your computer screen with your phone camera to instantly send or receive files.
- 🔥 **Burn-After-Reading**: Files are deleted from the server disk immediately after download.
- ⏱️ **5-Minute Auto-Expiry**: Background cleanup ticker runs every 30 seconds to wipe any unclaimed files.
- 🔒 **Optional Passkey Protection (`AUTH_KEY`)**: Protect your personal instance against spam or strangers using an environment variable. QR codes automatically inherit the passkey so phone users never have to type it!
- 📦 **Zero External Go Dependencies**: Built purely with the standard library (`net/http`, `crypto/rand`, `sync`, etc.).
- 🚀 **Ephemeral & Container-Friendly**: Runs on minimal RAM (<15 MB) and streams chunks directly to disk with a 50 MB limit.

---

## 🚀 Quick Start (Local Run)

### Prerequisites
- [Go 1.22+](https://golang.org/dl/)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/fileShare.git
cd fileShare

# 2. Run the server
go run main.go

# 3. Open in your browser
# Visit http://localhost:8080
```

---

## 🌐 Free Self-Hosting & Deployment Guide

To transfer files across different networks (e.g. phone on cellular 4G/5G and PC on Wi-Fi), the server needs a public HTTPS URL. Here are the best free hosting options:

### Option 1: Fly.io (Recommended)

Fly.io gives you a free `.fly.dev` HTTPS domain and runs from the provided `Dockerfile`.

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
2. **Login & Launch**:
   ```bash
   fly auth login
   fly launch --no-deploy
   ```
3. **(Optional) Set your secret password**:
   ```bash
   fly secrets set AUTH_KEY="your-secret-passkey"
   ```
4. **Deploy**:
   ```bash
   fly deploy
   ```
   Your app will be live at `https://<your-app-name>.fly.dev`.

---

### Option 2: Render.com

1. Create a free account on [Render.com](https://render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** as the runtime.
5. In **Environment Variables**, optionally add:
   - `AUTH_KEY` = `your-secret-passkey`
   - `PORT` = `8080`
6. Click **Create Web Service**. Render builds the `Dockerfile` and gives you a free HTTPS URL.

---

### Option 3: Docker / VPS / Raspberry Pi

You can run your own instance on any server with Docker:

```bash
# Build the image
docker build -t fileshare .

# Run publicly on port 8080
docker run -d -p 8080:8080 -e AUTH_KEY="your-secret-passkey" --name fileshare fileshare
```

Or using **Docker Compose** (`docker-compose.yml`):
```yaml
services:
  fileshare:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - AUTH_KEY=your-secret-passkey # Leave empty for open mode
    restart: unless-stopped
```

---

## 🔐 Securing Your Server (Anti-Spam & Privacy)

If you deploy your server to a public URL, anyone with the link could potentially upload files and consume server bandwidth.

### How to Enable Authentication:
Set the `AUTH_KEY` environment variable on your server:

```bash
export AUTH_KEY="mySecretKey123"
go run main.go
```

### How It Works:
1. **Open Mode (Default)**: If `AUTH_KEY` is not set, the server runs in open mode for anyone to use.
2. **Protected Mode (`AUTH_KEY` set)**:
   - Visiting the page prompts for the **Access Key** once and remembers it in your browser (`localStorage`).
   - You can also bypass the prompt by visiting: `https://your-server.com/?auth=mySecretKey123`.
   - **QR Token Inheritance**: When your computer generates a QR code, the authentication token is automatically embedded (`&auth=...`). When your phone scans the QR code, **it is authorized immediately without needing to type a password**!
   - Any API request without the valid key is blocked with `401 Unauthorized`.

---

## ⚙️ Configuration Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port the HTTP server binds to. |
| `AUTH_KEY` | *(empty)* | Optional master secret key. If set, requires authorization. |

---

## 🛠️ Project Structure

```
├── Dockerfile          # Multi-stage lightweight Alpine build
├── .dockerignore       # Excludes temporary uploads and build files
├── fly.toml            # Fly.io deployment configuration
├── go.mod              # Go module definition
├── main.go             # Go backend HTTP server & cleanup worker
└── public/             # Static frontend files
    ├── app.js          # QR code generation, polling, and API handling
    └── index.html      # Responsive UI with clean dual cards
```

---

## 📄 License

MIT License. Free to use, modify, and self-host.
