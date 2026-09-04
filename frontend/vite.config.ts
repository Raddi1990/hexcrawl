import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // During `npm run dev`, proxy API/WS calls to the FastAPI backend so the
    // frontend code can use plain relative paths in both dev and the single-
    // container production build (where the backend serves the SPA itself).
    proxy: {
      "/api": "http://localhost:8000",
      "/maps": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
