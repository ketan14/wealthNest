#!/usr/bin/env bash
# ==============================================================================
# WealthNest — Automated Native Linux Desktop Builder (Docker-Based)
# Compiles WebKitGTK and Rust binaries without installing tools on the host.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="wealthnest-desktop-builder"

echo "=================================================="
echo " WealthNest — Tauri 2 Desktop Docker Builder"
echo "=================================================="
echo "Project Root : $PROJECT_ROOT"
echo "Target       : Linux Desktop (.deb Package)"
echo "=================================================="

# 1. Build the builder container image (caches Rust and system libraries)
echo ""
echo "--- [1/2] Building Tauri Builder Docker Image ($IMAGE_NAME) ---"
docker build -t "$IMAGE_NAME" -f "$PROJECT_ROOT/infra/docker/Dockerfile.tauri" "$PROJECT_ROOT"

# 2. Run the build inside the container, mounting the project directory
echo ""
echo "--- [2/2] Compiling Frontend & Native Rust Desktop Binary ---"
docker run --rm \
  -v "$PROJECT_ROOT":/app \
  -w /app \
  "$IMAGE_NAME"

echo ""
echo "=================================================="
echo "✅ Linux Desktop Build Complete!"
echo "Your native installers are located on your host at:"
echo "👉 $PROJECT_ROOT/src-tauri/target/release/bundle/deb/"
echo "=================================================="
