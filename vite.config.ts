import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      // The collaborative repository never bundles the live API clients.
      { find: /^@\/services\/.*$/, replacement: path.resolve(__dirname, './src/mocks/services/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
}));
