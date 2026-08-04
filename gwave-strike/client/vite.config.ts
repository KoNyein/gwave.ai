import { defineConfig } from "vite";

export default defineConfig({
  // Rapier ships a WASM blob — Vite handles it, but pre-bundling the compat
  // package breaks its async init, so keep it out of optimizeDeps.
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
  // ★ Inline empty PostCSS config — without it Vite searches UPWARD, finds
  // the host repo's postcss.config.mjs (tailwind), and fails in CI where
  // tailwindcss isn't installed for this workspace.
  css: { postcss: { plugins: [] } },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
