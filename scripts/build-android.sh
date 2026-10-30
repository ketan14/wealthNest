#!/usr/bin/env bash
# ==============================================================================
# WealthNest — Tauri 2 Android APK & AAB Builder (Local Host or Docker)
# Usage:
#   ./scripts/build-android.sh           # Auto-detects Local SDK or falls back to Docker
#   ./scripts/build-android.sh local     # Builds using host Android SDK / NDK & Rust
#   ./scripts/build-android.sh docker    # Builds inside isolated Docker container (Zero host setup)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="wealthnest-android-builder"

MODE="${1:-auto}"

echo "=================================================="
echo " WealthNest — Tauri 2 Android Mobile Builder"
echo "=================================================="
echo "Project Root : $PROJECT_ROOT"
echo "Build Mode   : $MODE"
echo "=================================================="

build_via_docker() {
  echo ""
  echo "--- [1/2] Building Android Builder Docker Image ($IMAGE_NAME) ---"
  docker build -t "$IMAGE_NAME" -f "$PROJECT_ROOT/infra/docker/Dockerfile.android" "$PROJECT_ROOT"

  echo ""
  echo "--- [2/2] Compiling Frontend & Native Android APK/AAB inside Docker ---"
  docker run --rm \
    -v "$PROJECT_ROOT":/app \
    -w /app \
    "$IMAGE_NAME"
}

build_via_local_host() {
  echo ""
  echo "--- [1/4] Validating Local Host Android Toolchain ---"

  if [ -z "${ANDROID_HOME:-}" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
      export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "/opt/android-sdk" ]; then
      export ANDROID_HOME="/opt/android-sdk"
    else
      echo "❌ Error: ANDROID_HOME is not set and Android SDK was not found at ~/Android/Sdk."
      echo "👉 Tip: Run './scripts/build-android.sh docker' to build without installing Android Studio."
      exit 1
    fi
  fi

  if [ -z "${NDK_HOME:-}" ]; then
    if [ -d "$ANDROID_HOME/ndk" ]; then
      LATEST_NDK="$(ls -1 "$ANDROID_HOME/ndk" | sort -V | tail -n 1)"
      if [ -n "$LATEST_NDK" ]; then
        export NDK_HOME="$ANDROID_HOME/ndk/$LATEST_NDK"
      fi
    fi
  fi

  if [ -z "${NDK_HOME:-}" ] || [ ! -d "$NDK_HOME" ]; then
    echo "❌ Error: NDK_HOME is not set or NDK directory not found under $ANDROID_HOME/ndk."
    echo "👉 Install NDK via Android Studio SDK Manager or run './scripts/build-android.sh docker'."
    exit 1
  fi

  echo "✅ ANDROID_HOME : $ANDROID_HOME"
  echo "✅ NDK_HOME     : $NDK_HOME"
  echo "✅ JAVA_HOME    : ${JAVA_HOME:-$(which java || echo 'system default')}"

  echo ""
  echo "--- [2/4] Ensuring Rust Android Cross-Compilation Targets ---"
  rustup target add \
    aarch64-linux-android \
    armv7-linux-androideabi \
    i686-linux-android \
    x86_64-linux-android

  cd "$PROJECT_ROOT"

  echo ""
  echo "--- [3/4] Initializing Tauri Android Project (if needed) ---"
  if [ ! -d "$PROJECT_ROOT/src-tauri/gen/android" ]; then
    npx tauri android init
  else
    echo "ℹ️  Android project already initialized at src-tauri/gen/android"
  fi

  # Sync WealthNest branded launcher icons into Android resource directory
  if [ -d "$PROJECT_ROOT/src-tauri/gen/android/app/src/main/res" ] && [ -d "$PROJECT_ROOT/src-tauri/icons/android" ]; then
    echo "🎨 Syncing WealthNest app launcher icons to Android res/mipmap..."
    cp -r "$PROJECT_ROOT"/src-tauri/icons/android/mipmap-* "$PROJECT_ROOT/src-tauri/gen/android/app/src/main/res/"
  fi

  echo ""
  echo "--- [4/5] Building Frontend & Compiling Android APK / AAB ---"
  npx tauri android build --apk

  echo ""
  echo "--- [5/5] Ensuring Signed Installable APK (Android Package Verifier) ---"
  sign_release_apk "$ANDROID_HOME"
}

sign_release_apk() {
  local sdk_root="$1"
  local apk_dir="$PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/apk/universal/release"
  local unsigned_apk="$apk_dir/app-universal-release-unsigned.apk"
  local signed_apk="$apk_dir/wealthnest-offline-signed.apk"
  local keystore_path="$PROJECT_ROOT/src-tauri/gen/android/wealthnest-local.keystore"

  if [ ! -f "$unsigned_apk" ]; then
    echo "ℹ️  No unsigned APK found at $unsigned_apk (APK may already be signed)."
    return 0
  fi

  if [ ! -f "$keystore_path" ]; then
    echo "🔑 Generating local Android signing keystore at $keystore_path..."
    keytool -genkeypair -v \
      -keystore "$keystore_path" \
      -alias wealthnest \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000 \
      -storepass wealthnest123 \
      -keypass wealthnest123 \
      -dname "CN=Ketan Vaghela, OU=WealthNest, O=Vaghela Household, L=Ahmedabad, ST=Gujarat, C=IN"
  fi

  local build_tools_dir=""
  if [ -d "$sdk_root/build-tools" ]; then
    local latest_bt
    latest_bt="$(ls -1 "$sdk_root/build-tools" | sort -V | tail -n 1)"
    build_tools_dir="$sdk_root/build-tools/$latest_bt"
  fi

  if [ -n "$build_tools_dir" ] && [ -x "$build_tools_dir/apksigner" ]; then
    local aligned_apk="$apk_dir/app-universal-release-aligned.apk"
    if [ -x "$build_tools_dir/zipalign" ]; then
      "$build_tools_dir/zipalign" -f -p 4 "$unsigned_apk" "$aligned_apk"
    else
      cp "$unsigned_apk" "$aligned_apk"
    fi
    "$build_tools_dir/apksigner" sign \
      --ks "$keystore_path" \
      --ks-key-alias wealthnest \
      --ks-pass pass:wealthnest123 \
      --key-pass pass:wealthnest123 \
      --out "$signed_apk" \
      "$aligned_apk"
    rm -f "$aligned_apk"
    echo "✅ Signed install-ready APK created: $signed_apk"
  elif command -v jarsigner >/dev/null 2>&1; then
    cp "$unsigned_apk" "$signed_apk"
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
      -keystore "$keystore_path" \
      -storepass wealthnest123 \
      -keypass wealthnest123 \
      "$signed_apk" wealthnest
    echo "✅ Signed install-ready APK created via jarsigner: $signed_apk"
  fi
}

if [ "$MODE" = "docker" ]; then
  build_via_docker
elif [ "$MODE" = "local" ]; then
  build_via_local_host
elif [ "$MODE" = "sign-only" ]; then
  sign_release_apk "${ANDROID_HOME:-/opt/android-sdk}"
  exit 0
else
  # Auto-detect: use local host if ANDROID_HOME + rustup exist, otherwise use Docker
  if { [ -n "${ANDROID_HOME:-}" ] || [ -d "$HOME/Android/Sdk" ]; } && command -v rustup >/dev/null 2>&1; then
    echo "ℹ️  Detected local Android SDK & Rust toolchain -> running local build..."
    build_via_local_host
  else
    echo "ℹ️  Local Android SDK/NDK not detected -> falling back to isolated Docker builder..."
    build_via_docker
  fi
fi

echo ""
echo "=================================================="
echo "✅ Android Build Complete!"
echo "Your APK and AAB artifacts are located at:"
echo "👉 Signed Installable APK : $PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/apk/universal/release/wealthnest-offline-signed.apk"
echo "👉 Release APK Directory  : $PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/apk/universal/release/"
echo "👉 AAB Bundle Directory   : $PROJECT_ROOT/src-tauri/gen/android/app/build/outputs/bundle/universalRelease/"
echo "=================================================="

