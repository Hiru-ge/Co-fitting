# --- Development Stage ---
FROM golang:1.25.6-alpine

WORKDIR /app

# Development dependencies
RUN apk add --no-cache git make

# Copy go files
COPY go.mod go.sum ./
RUN go mod download

# Mount entire app volume for hot reload
COPY . .

# Default CMD runs the app directly with air if air config exists, otherwise go run
CMD ["sh", "-c", "if [ -f .air.toml ]; then air; else go run main.go; fi"]