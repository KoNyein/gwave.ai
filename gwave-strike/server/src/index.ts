import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";

import { MatchRoom } from "./rooms/MatchRoom.js";

/// Colyseus server (blueprint §4) + the built client as static files, one
/// process: in production this container sits behind Caddy's
/// `handle_path /strike/*`, so "/" here is gwave.cc/strike/. The express
/// integration is REQUIRED, not cosmetic — Colyseus prepends its router to
/// the http server and, without an express app to fall through to, answers
/// 404 for every non-matchmaking path (health checks, the client itself).

const PORT = Number(process.env.PORT) || 2567;

/** Built client (client/dist). Absent in pure-server dev runs — fine: the
 *  game endpoints still work and static requests 404. */
const STATIC_DIR = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : resolve(process.cwd(), "..", "client", "dist");

const http = createServer();

const game = new Server({
  transport: new WebSocketTransport({ server: http }),
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true, phase: 5 });
    });
    if (existsSync(STATIC_DIR)) {
      // Hashed bundles + vendored decoders + models are immutable; the HTML
      // shell must revalidate so a deploy is picked up on next load.
      app.use(
        express.static(STATIC_DIR, {
          index: "index.html",
          setHeaders: (res, path) => {
            const immutable =
              /[/\\](assets|decoders)[/\\]/.test(path) || path.endsWith(".glb");
            res.setHeader(
              "Cache-Control",
              immutable ? "public, max-age=31536000, immutable" : "no-cache",
            );
          },
        }),
      );
    }
  },
});
game.define("match", MatchRoom);

void game.listen(PORT).then(() => {
  console.log(`[gwave-strike] Colyseus + static client on :${PORT}`);
});
