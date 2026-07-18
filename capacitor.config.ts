import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.covo.app',
  appName: 'Sumac Travel',
  webDir: 'dist',
  server: {
    // No 'url' → uses the local dist bundle baked into the APK
    cleartext: true,               // Allow HTTP connections (backend on public IP)
    androidScheme: 'http',         // Allow mixed content
  },
  android: {
    allowMixedContent: true,       // Required for HTTP backend from HTTPS webview
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,               // ✅ Makes ALL fetch() calls go through Android's native HTTP — bypasses CORS/ngrok preflight issues
    },
  },
};

export default config;
