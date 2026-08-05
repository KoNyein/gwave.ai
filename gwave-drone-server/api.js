// server/api.js — gwave game REST API (tasks 7.2, 7.3, 7.5)
// Storage: DATABASE_URL ရှိရင် Postgres (pg) · မရှိရင် in-memory (local dev)
// Production: API Gateway + Lambda ကူးလို့ရအောင် handler တွေ pure function
// Run: node api.js   (port 8788)
import http from 'node:http';
import { verifyToken, authMode } from './auth.js';

const PORT = process.env.API_PORT ?? 8788;

// ---------- storage layer ----------
// GAME_DATABASE_URL first — the shared /etc/gwave-web.env must not need a
// generic DATABASE_URL name that another service could also claim
const dbUrl = process.env.GAME_DATABASE_URL ?? process.env.DATABASE_URL;
let store;
if (dbUrl) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    // RDS requires TLS; the CA is not in the container's trust store
    ssl: { rejectUnauthorized: false },
  });
  store = {
    async getPlayer(id) {
      const r = await pool.query(
        `INSERT INTO game.players (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
         RETURNING *`, [id]);
      return r.rows[0];
    },
    async addStats(id, k, d, dk) {
      await pool.query(
        `UPDATE game.players SET kills = kills + $2, deaths = deaths + $3,
         drone_kills = drone_kills + $4, xp = xp + $2 * 25, updated_at = now()
         WHERE user_id = $1`, [id, k, d, dk]);
    },
    async setName(id, name) {
      await pool.query(`UPDATE game.players SET display_name = $2 WHERE user_id = $1`, [id, name]);
    },
    async getBuild(id) {
      const r = await pool.query(
        `SELECT build, rates FROM game.drone_builds WHERE user_id = $1 AND is_active LIMIT 1`, [id]);
      return r.rows[0] ?? null;
    },
    async putBuild(id, build, rates) {
      await pool.query(
        `INSERT INTO game.drone_builds (user_id, name, build, rates)
         VALUES ($1, 'My Build', $2, $3)
         ON CONFLICT (user_id, name) DO UPDATE SET build = $2, rates = $3, updated_at = now()`,
        [id, build, rates]);
    },
    async leaderboard(limit = 20) {
      const r = await pool.query(`SELECT * FROM game.leaderboard LIMIT $1`, [limit]);
      return r.rows;
    },
  };
  console.log('[api] storage: Postgres');
} else {
  const players = new Map(), builds = new Map();
  const P = id => {
    if (!players.has(id)) players.set(id, {
      user_id: id, display_name: 'Pilot', mmr: 1000, level: 1, xp: 0,
      kills: 0, deaths: 0, wins: 0, drone_kills: 0, matches: 0 });
    return players.get(id);
  };
  store = {
    async getPlayer(id) { return P(id); },
    async addStats(id, k, d, dk) {
      const p = P(id); p.kills += k; p.deaths += d; p.drone_kills += dk; p.xp += k * 25;
    },
    async setName(id, name) { P(id).display_name = name; },
    async getBuild(id) { return builds.get(id) ?? null; },
    async putBuild(id, build, rates) { builds.set(id, { build, rates }); },
    async leaderboard(limit = 20) {
      return [...players.values()].sort((a, b) => b.mmr - a.mmr || b.kills - a.kills)
        .slice(0, limit).map((p, i) => ({ ...p, rank: i + 1 }));
    },
  };
  console.log('[api] storage: in-memory (DATABASE_URL မရှိ — dev mode)');
}
export const storage = store;

// ---------- HTTP ----------
const json = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
};
const readBody = req => new Promise(r => {
  let s = ''; req.on('data', c => s += c);
  req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } });
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, {});
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);

  // auth (all endpoints except leaderboard)
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const user = await verifyToken(token);

  try {
    // GET /health — deploy gate (no auth, no DB)
    if (req.method === 'GET' && parts[0] === 'health')
      return json(res, 200, { ok: true, service: 'gwave-drone', authMode });

    // GET /leaderboard
    if (req.method === 'GET' && parts[0] === 'leaderboard')
      return json(res, 200, await store.leaderboard(+url.searchParams.get('limit') || 20));

    // POST /report — game server stat delta (server-to-server; GAME_KEY auth, user token မလို)
    if (req.method === 'POST' && parts[0] === 'report') {
      if ((req.headers['x-game-key'] ?? '') !== (process.env.GAME_KEY ?? 'dev-key'))
        return json(res, 403, { error: 'bad game key' });
      const { sub, kills = 0, deaths = 0, droneKills = 0 } = await readBody(req);
      await store.getPlayer(sub);
      await store.addStats(sub, kills, deaths, droneKills);
      return json(res, 200, { ok: true });
    }

    if (!user) return json(res, 401, { error: 'unauthorized', authMode });

    // GET /me — profile + stats (auto-create)
    if (req.method === 'GET' && parts[0] === 'me' && parts.length === 1) {
      const p = await store.getPlayer(user.sub);
      return json(res, 200, { ...p, avatarGlb: user.avatarGlb ?? null });
    }
    // PUT /me/name
    if (req.method === 'PUT' && parts[0] === 'me' && parts[1] === 'name') {
      const { name } = await readBody(req);
      await store.getPlayer(user.sub);
      await store.setName(user.sub, String(name).slice(0, 24));
      return json(res, 200, { ok: true });
    }
    // GET/PUT /me/drone-config (task 7.3)
    if (parts[0] === 'me' && parts[1] === 'drone-config') {
      await store.getPlayer(user.sub);
      if (req.method === 'GET') return json(res, 200, await store.getBuild(user.sub) ?? {});
      if (req.method === 'PUT') {
        const { build, rates } = await readBody(req);
        await store.putBuild(user.sub, build ?? {}, rates ?? {});
        return json(res, 200, { ok: true });
      }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e.message) });
  }
});
server.listen(PORT, () => console.log(`[api] http://0.0.0.0:${PORT} (auth: ${authMode})`));
