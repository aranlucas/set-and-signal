/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backend = process.env.API_TARGET || "http://127.0.0.1:3000";

const media = process.env.MEDIA_TARGET;

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

const proxy: Record<string, ProxyOptions> = {};

proxy["/api"] = { target: backend, changeOrigin: true };

if (media) {
  proxy["/img"] = { target: media, changeOrigin: true };
  proxy["/gif"] = { target: media, changeOrigin: true };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: { "@": srcDir },
  },
  server: {
    proxy,
  },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
