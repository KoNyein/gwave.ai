import { defineConfig } from "vite";

export default defineConfig({
  // Rapier ships a WASM blob — Vite handles it, but pre-bundling the compat
  // package breaks its async init, so keep it out of optimizeDeps.
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
