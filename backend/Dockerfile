# --- Build Stage ---
FROM golang:1.25.6-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# 【変更点】バイナリの出力先を /app ではなく一時的な場所に
RUN go build -o /tmp/main .

# --- Run Stage ---
FROM alpine:latest
WORKDIR /app
# 【変更点】バイナリを /usr/local/bin (PATHが通っている場所) にコピー
COPY --from=builder /tmp/main /usr/local/bin/roamble-backend
# 実行権限付与
RUN chmod +x /usr/local/bin/roamble-backend

# 【変更点】配置したバイナリを実行
CMD ["roamble-backend"]