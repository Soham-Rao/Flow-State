import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");

  if (normalized.includes("/socket.io-client/")) {
    return "socket-vendor";
  }
  if (normalized.includes("/lucide-react/")) {
    return "ui-vendor";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true
      }
    }
  }
});
