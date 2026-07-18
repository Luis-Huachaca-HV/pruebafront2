#!/bin/bash
set -e

FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$FRONTEND_DIR/android"

echo "==> Build web assets"
cd "$FRONTEND_DIR"
npm run build

echo "==> Sync Capacitor"
npx cap sync android

echo "==> Build APK"
cd "$ANDROID_DIR"
./gradlew assembleDebug

echo "==> Reverse backend port for physical device"
adb reverse tcp:8000 tcp:8000

echo "==> Install on device"
adb install -r app/build/outputs/apk/debug/app-debug.apk

echo "==> Launch app"
adb shell monkey -p com.example.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo "==> Done. Streaming logs (Ctrl+C to stop)..."
adb logcat -s Capacitor chromium WebView System.err
