.PHONY: build test lint fmt vet install release clean manifest-validate gui-dev gui-build bench bench-cpu bench-mem

BINARY=secwin
VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS=-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildTime=$(BUILD_TIME)

GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

# =============================================================================
# Core Build Targets
# =============================================================================

build:
	@echo "Building $(BINARY) v$(VERSION) for $(GOOS)/$(GOARCH)..."
	@go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY) ./cmd/secwin

build-all:
	@echo "Building for all platforms..."
	@GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY)_windows_amd64.exe ./cmd/secwin
	@GOOS=windows GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY)_windows_arm64.exe ./cmd/secwin
	@GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY)_linux_amd64 ./cmd/secwin
	@GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY)_linux_arm64 ./cmd/secwin

# =============================================================================
# Testing & Quality
# =============================================================================

test:
	@go test -race -coverprofile=coverage.out ./...

test-verbose:
	@go test -v -race ./...

bench:
	@go test -bench=. -benchmem -benchtime=3s ./benchmarks/...

bench-cpu:
	@go test -bench=. -benchmem -benchtime=10s -cpuprofile=cpu.prof ./benchmarks/...

bench-mem:
	@go test -bench=. -benchmem -benchtime=10s -memprofile=mem.prof ./benchmarks/...

lint:
	@golangci-lint run ./...

fmt:
	@go fmt ./...
	@goimports -w .

vet:
	@go vet ./...

manifest-validate:
	@go run ./cmd/secwin manifest validate --all

# =============================================================================
# GUI Targets (Tauri)
# =============================================================================

gui-dev:
	@cd ui && npm run tauri:dev

gui-build:
	@cd ui && npm run tauri:build

gui-install:
	@cd ui && npm install

gui-lint:
	@cd ui && npm run lint

# =============================================================================
# Installation & Release
# =============================================================================

install: build
	@cp bin/$(BINARY) $(GOBIN)/$(BINARY)

release: build-all
	@mkdir -p dist
	@cd bin && sha256sum $(BINARY)_* > ../dist/checksums.txt
	@echo "Release artifacts in dist/"

# =============================================================================
# Development
# =============================================================================

clean:
	@rm -rf bin dist coverage.out cpu.prof mem.prof
	@cd ui && rm -rf node_modules dist build 2>/dev/null || true

dev-setup:
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@go install golang.org/x/tools/cmd/goimports@latest
	@pre-commit install
	@cd ui && npm install 2>/dev/null || echo "GUI deps will be installed on first gui-dev"

generate:
	@go generate ./...

check: fmt vet lint test manifest-validate
	@echo "All checks passed"

# =============================================================================
# Full Pipeline
# =============================================================================

all: clean dev-setup check build gui-build release
	@echo "Full build pipeline complete"