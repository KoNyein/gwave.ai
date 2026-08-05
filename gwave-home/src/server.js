/**
 * ============================================================
 * GWAVE SMART SYSTEM ENGINE - API Server
 * ------------------------------------------------------------
 * Run: node src/server.js   (config.json လိုတယ်)
 *
 * ပေါင်းစည်းထားတဲ့ components:
 *   Device Registry + Traits + Permissions   (L4)
 *   Connectors: onvif | tuya | mqtt          (L3)
 *   Rules Engine + Notifier                  (L5)
 *
 * API:
 *   GET  /api/devices                     မိမိ devices အားလုံး
 *   POST /api/devices/discover            {connector}
 *   POST /api/devices/register            registry ထဲသွင်း
 *   GET  /api/devices/:id/state
 *   GET  /api/devices/:id/stream?protocol=
 *   POST /api/devices/:id/execute         {command, params}
 *   POST /api/devices/:id/share           {userId, role}
 *   GET  /api/devices/:id/events
 *   GET  /api/devices/:id/history?trait=&hours=   sensor chart data
 *   GET  /api/rules?siteId=
 *   POST /api/rules                       rule အသစ်/update
 *   DELETE /api/rules/:id
 *   POST /api/provision                   ESP32 MQTT credentials ထုတ်
 *   POST /api/mqtt/auth                   EMQX auth webhook
 * ============================================================
 */

const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");

const { loadConfig } = require("./config");
const { startBroker } = require("./broker");
const { Registry } = require("./registry");
const { RulesEngine } = require("./rules-engine");
const { Notifier } = require("./notify");
const { OnvifRtspConnector } = require("./connectors/onvif-rtsp");
const { TuyaConnector } = require("./connectors/tuya");
const { MqttConnector } = require("./connectors/mqtt");

const cfg = loadConfig();

const pool = new Pool(cfg.postgres);
// A dead RDS must not kill the process — routes fail per-request instead.
pool.on("error", (e) => console.error("[pg]", e.message));

// Embedded MQTT broker (aedes). Async — the connector's 3s reconnect loop
// rides out the brief window before the broker is listening.
startBroker(cfg, pool).catch((e) => console.error("[broker]", e.message));

// ----- Connectors: brand/protocol အသစ် = ဒီမှာတစ်ကြောင်းတိုးရုံ -----
const mqttConnector = new MqttConnector(cfg);
const connectors = {
  onvif: new OnvifRtspConnector(cfg),
  tuya: new TuyaConnector(cfg),
  mqtt: mqttConnector,
};

const registry = new Registry(pool, connectors);
const notifier = new Notifier(pool, cfg);
const rules = new RulesEngine(pool, registry, notifier);

// MQTT connector ကို registry/pool ချိတ် + state change → rules engine
mqttConnector.init(registry, pool);
mqttConnector.onStateChange = (deviceId, values) =>
  rules.onStateChange(deviceId, values).catch(console.error);

const app = express();
app.use(express.json());

// Liveness for the deploy pipeline — no auth, no DB.
app.get("/health", (_req, res) => res.json({ ok: true, service: "gwave-home" }));

// ----- EMQX auth webhook (device credentials) — user auth မလိုတဲ့ route -----
app.post("/api/mqtt/auth", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hash = crypto.createHash("sha256").update(password || "").digest("hex");
    const { rows } = await pool.query(
      `SELECT 1 FROM gh_device_credentials
       WHERE mqtt_username=$1 AND mqtt_password_hash=$2`,
      [username, hash]
    );
    res.json({ result: rows.length ? "allow" : "deny" });
  } catch {
    res.json({ result: "deny" });
  }
});

// ----- Auth middleware -----
// x-user-id is TRUSTED INPUT: the API binds to loopback and the only public
// door is the Next.js proxy (/api/home/*), which verifies the Cognito
// session first and stamps the profile id here. GH_PROXY_KEY adds a shared
// secret so nothing else on the box can impersonate the proxy.
app.use((req, res, next) => {
  if (cfg.proxyKey && req.headers["x-proxy-key"] !== cfg.proxyKey) {
    return res.status(401).json({ error: "proxy key မမှန်ပါ" });
  }
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "x-user-id header လိုပါတယ်" });
  req.userId = userId;
  next();
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

// ================= SITES =================
// The UI needs these — without site CRUD the first site required raw SQL.
app.get("/api/sites", wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, created_at FROM gh_sites WHERE owner_id=$1 ORDER BY created_at`,
    [req.userId]
  );
  res.json(rows);
}));

app.post("/api/sites", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (!name) throw new Error("Site နာမည် လိုပါတယ်");
  const id = `site_${crypto.randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO gh_sites (id, owner_id, name) VALUES ($1,$2,$3)`,
    [id, req.userId, name]
  );
  res.json({ id, name });
}));

// ================= DEVICES =================
app.get("/api/devices", wrap(async (req, res) => {
  res.json(await registry.listForUser(req.userId));
}));

app.post("/api/devices/discover", wrap(async (req, res) => {
  res.json(await registry.discover(req.userId, req.body.connector));
}));

app.post("/api/devices/register", wrap(async (req, res) => {
  const { siteId, connector, found, name } = req.body;
  const id = await registry.register(req.userId, siteId, connector, found, name);
  res.json({ id });
}));

app.get("/api/devices/:id/state", wrap(async (req, res) => {
  res.json(await registry.getState(req.userId, req.params.id));
}));

app.get("/api/devices/:id/stream", wrap(async (req, res) => {
  res.json(
    await registry.getStreamUrl(req.userId, req.params.id, req.query.protocol)
  );
}));

app.post("/api/devices/:id/execute", wrap(async (req, res) => {
  const { command, params } = req.body;
  res.json(await registry.execute(req.userId, req.params.id, command, params || {}));
}));

app.post("/api/devices/:id/share", wrap(async (req, res) => {
  const device = await registry.getDeviceAuthorized(req.userId, req.params.id);
  if (device.owner_id !== req.userId) throw new Error("Owner သာ share လုပ်နိုင်ပါတယ်");
  await pool.query(
    `INSERT INTO gh_device_shares (device_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (device_id, user_id) DO UPDATE SET role=$3`,
    [req.params.id, req.body.userId, req.body.role || "viewer"]
  );
  res.json({ ok: true });
}));

app.get("/api/devices/:id/events", wrap(async (req, res) => {
  await registry.getDeviceAuthorized(req.userId, req.params.id);
  const { rows } = await pool.query(
    `SELECT type, payload, created_at FROM gh_events
     WHERE device_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json(rows);
}));

// Sensor history — chart ဆွဲဖို့ data
app.get("/api/devices/:id/history", wrap(async (req, res) => {
  await registry.getDeviceAuthorized(req.userId, req.params.id);
  const hours = Math.min(Number(req.query.hours) || 24, 24 * 30);
  const { rows } = await pool.query(
    `SELECT time, value FROM sensor_readings
     WHERE device_id=$1 AND trait=$2 AND time > now() - ($3 || ' hours')::interval
     ORDER BY time`,
    [req.params.id, req.query.trait, String(hours)]
  );
  res.json(rows);
}));

// ================= RULES =================
app.get("/api/rules", wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.* FROM gh_rules r JOIN gh_sites s ON s.id = r.site_id
     WHERE s.owner_id=$1 AND ($2::text IS NULL OR r.site_id=$2)`,
    [req.userId, req.query.siteId || null]
  );
  res.json(rows);
}));

app.post("/api/rules", wrap(async (req, res) => {
  const { id, siteId, name, enabled = true, definition } = req.body;
  const { rows } = await pool.query(
    `SELECT 1 FROM gh_sites WHERE id=$1 AND owner_id=$2`,
    [siteId, req.userId]
  );
  if (!rows.length) throw new Error("Site မတွေ့ပါ (သို့) ခွင့်မရှိပါ");
  const ruleId = id || `rule_${crypto.randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO gh_rules (id, site_id, name, enabled, definition)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name=$3, enabled=$4, definition=$5`,
    [ruleId, siteId, name, enabled, definition]
  );
  await rules.reload();
  res.json({ id: ruleId });
}));

app.delete("/api/rules/:id", wrap(async (req, res) => {
  await pool.query(
    `DELETE FROM gh_rules r USING gh_sites s
     WHERE r.id=$1 AND s.id=r.site_id AND s.owner_id=$2`,
    [req.params.id, req.userId]
  );
  await rules.reload();
  res.json({ ok: true });
}));

// ================= PROVISIONING (ESP32 credentials) =================
app.post("/api/provision", wrap(async (req, res) => {
  const { siteId, deviceKey } = req.body;
  const { rows } = await pool.query(
    `SELECT 1 FROM gh_sites WHERE id=$1 AND owner_id=$2`,
    [siteId, req.userId]
  );
  if (!rows.length) throw new Error("Site မတွေ့ပါ (သို့) ခွင့်မရှိပါ");
  const username = `${siteId}_${deviceKey}`;
  const password = crypto.randomBytes(12).toString("base64url");
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  await pool.query(
    `INSERT INTO gh_device_credentials (mqtt_username, site_id, device_key, mqtt_password_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (mqtt_username) DO UPDATE SET mqtt_password_hash=$4`,
    [username, siteId, deviceKey, hash]
  );
  // password ကို ဒီတစ်ခါပဲပြမယ် — ESP32 config ထဲထည့်ရန်
  res.json({ mqttUsername: username, mqttPassword: password });
}));

// ================= START =================
setInterval(() => registry.pollHealth(), (cfg.healthPollSeconds || 30) * 1000);

const port = cfg.port || 4000;
app.listen(port, async () => {
  console.log(`🏠 GWAVE Smart System Engine — port ${port} မှာ run နေပြီ`);
  await rules.start();
});
