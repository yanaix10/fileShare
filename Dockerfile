# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod ./
RUN go mod download

# Copy source code
COPY main.go ./

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server main.go

# Runtime Stage
FROM alpine:3.20

WORKDIR /app

# Install CA certificates
RUN apk --no-cache add ca-certificates tzdata

# Create uploads directory
RUN mkdir -p uploads public

# Copy binary and public assets
COPY --from=builder /app/server .
COPY public/ ./public/

# Expose port
EXPOSE 8080

# Run the server
CMD ["./server"]
