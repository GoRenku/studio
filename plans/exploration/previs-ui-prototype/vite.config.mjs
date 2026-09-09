import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const studio = fileURLToPath(new URL('../../../packages/studio/', import.meta.url));

export default defineConfig({
  cacheDir: '.vite-cache',
  resolve: {
    alias: { '@': `${studio}src` },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: 4177,
    strictPort: true,
    watch: { usePolling: true },
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), tailwindcss()],
});
