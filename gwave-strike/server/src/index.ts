import { createServer } from "node:http";

/// Phase 1 stub — health endpoint only. Phase 3 replaces this with the
/// Colyseus server (MatchRoom, authoritative sim) per blueprint §4.

const PORT = Number(process.env.PORT) || 2567;

createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, phase: 1 }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, () => {
  console.log(`[gwave-strike] health server on :${PORT} (Colyseus in Phase 3)`);
});
