import { createServer } from "node:http";

import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

import { MatchRoom } from "./rooms/MatchRoom.js";

/// Colyseus server (blueprint §4) + plain health endpoint for the Nginx /
/// deploy checks. WebSocket path is proxied at /colyseus/ in production.

const PORT = Number(process.env.PORT) || 2567;

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, phase: 3 }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const game = new Server({
  transport: new WebSocketTransport({ server: http }),
});
game.define("match", MatchRoom);

http.listen(PORT, () => {
  console.log(`[gwave-strike] Colyseus on :${PORT}`);
});
