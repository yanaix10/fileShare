# fileShare

A lightweight, ephemeral file-sharing web application built with Go and Vanilla JS. Transfer files between computers and mobile devices using 4-character PINs and QR codes.

No accounts or mobile apps required. Files are deleted immediately after download or after 5 minutes.

---

## Features

- **QR Code Handshake**: Scan a QR code on your computer screen with your phone camera to send or receive files.
- **Burn-After-Reading**: Files are deleted from server disk immediately upon download.
- **5-Minute Auto-Expiry**: A background worker purges unclaimed files every 30 seconds after 5 minutes.
- **60 MB File Limit**: Uploads are streamed directly to disk and capped at 60 MB.
- **Optional Passkey (`AUTH_KEY`)**: Protect your server from unauthorized use. QR codes inherit the passkey automatically so mobile users never need to type it.
- **Zero External Go Dependencies**: Built entirely with the Go standard library.

---

## Quick Start (Local)

### Prerequisites
- Go 1.22+

```bash
git clone https://github.com/yanaix10/fileShare.git
cd fileShare
go run main.go
```

Open `http://localhost:8080` in your browser.

---

## Deployment & Self-Hosting

### 1. Render (Recommended, Free, No Credit Card Required)

1. Sign up on [Render.com](https://render.com) using your GitHub account.
2. Click **New +** > **Web Service**.
3. Select your `fileShare` repository.
4. Set the runtime to **Docker** and select the **Free** instance type.
5. (Optional) Under **Environment Variables**, add:
   - `AUTH_KEY` = `your-password` (leave empty for open mode)
   - `PORT` = `8080`
6. Click **Create Web Service**.

### 2. Fly.io

```bash
fly launch --no-deploy
fly secrets set AUTH_KEY="your-password"  # Optional
fly deploy
```

### 3. Docker

```bash
docker build -t fileshare .
docker run -d -p 8080:8080 -e AUTH_KEY="your-password" --name fileshare fileshare
```

Docker Compose (`docker-compose.yml`):
```yaml
services:
  fileshare:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - AUTH_KEY=your-password
    restart: unless-stopped
```

---

## Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port the server listens on. |
| `AUTH_KEY` | *(empty)* | Optional access key. If set, requires authorization for uploads and downloads. |

---

## License

MIT
