.PHONY: build run test fmt tidy help

# 環境変数
GO := go
GOFLAGS := -v
BINARY_NAME := roamble

help:
	@echo "Available commands:"
	@echo "  make build    - Build the Go binary"
	@echo "  make run      - Run the application locally"
	@echo "  make test     - Run unit tests"
	@echo "  make fmt      - Format code (gofmt)"
	@echo "  make tidy     - Run go mod tidy"
	@echo "  make clean    - Remove binary"

build:
	$(GO) build $(GOFLAGS) -o $(BINARY_NAME) .

run: build
	./$(BINARY_NAME)

test:
	$(GO) test $(GOFLAGS) ./...

fmt:
	$(GO) fmt ./...

tidy:
	$(GO) mod tidy

clean:
	rm -f $(BINARY_NAME)
