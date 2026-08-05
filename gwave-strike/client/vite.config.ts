import { defineConfig } from "vite";

export default defineConfig({
  // Served from gwave.cc/strike (Caddy handle_path → the strike container),
  // not a domain root — every built URL must carry the prefix.
  base: "/strike/",
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
