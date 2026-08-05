/**
 * ============================================================
 * MQTT CONNECTOR (Connector #3) — ကိုယ်ပိုင် Hardware Plane
 * ------------------------------------------------------------
 * ESP32/ESPHome nodes တွေနဲ့ ဒီ topic convention နဲ့ဆက်သွယ်တယ်:
 *
 *   gw/{siteId}/{deviceKey}/config   device က ကိုယ့် traits ကြေညာ (retained)
 *                                    → auto-discovery + auto-register
 *   gw/{siteId}/{deviceKey}/state    {"values":{"sensor.temperature":27.5}}
 *                                    → cache + sensor_readings ingest
 *   gw/{siteId}/{deviceKey}/event    {"type":"motion", ...}
 *   gw/{siteId}/{deviceKey}/lwt      "offline" (Last Will) → offline detect
 *   gw/{siteId}/{deviceKey}/cmd      server → device command
 * ============================================================
 */

const mqtt = require("mqtt");
const { BaseConnector } = require("./base");

class MqttConnector extends BaseConnector {
  static get name() {
    return "mqtt";
  }

  constructor(cfg) {
    super();
    this.cfg = cfg.mqtt;                 // { url, username, password }
    this.cache = new Map();              // "site/devKey" -> {online, values, ts}
    this.onStateChange = null;           // rules engine hook
    this.registry = null;
    this.pool = null;
    this.client = null;
  }

  /** server.js က registry/pool ဆောက်ပြီးမှ ခေါ်တယ် */
  init(registry, pool) {
    this.registry = registry;
    this.pool = pool;
    this.client = mqtt.connect(this.cfg.url, {
      username: this.cfg.username,
      password: this.cfg.password,
      reconnectPeriod: 3000,
    });

    this.client.on("connect", () => {
      console.log("📡 MQTT broker ချိတ်ပြီး:", this.cfg.url);
      this.client.subscribe([
        "gw/+/+/config",
        "gw/+/+/state",
        "gw/+/+/event",
        "gw/+/+/lwt",
      ]);
    });

    this.client.on("message", (topic, payload) =>
      this._onMessage(topic, payload.toString()).catch((e) =>
        console.error(`[mqtt] ${topic}: ${e.message}`)
      )
    );
  }

  _key(siteId, devKey) {
    return `${siteId}/${devKey}`;
  }
  _deviceId(siteId, devKey) {
    return `dev_${siteId}_${devKey}`;
  }

  async _onMessage(topic, msg) {
    const [, siteId, devKey, channel] = topic.split("/");
    if (!siteId || !devKey) return;
    if (channel === "config") return this._onConfig(siteId, devKey, msg);
    if (channel === "state") return this._onState(siteId, devKey, msg);
    if (channel === "event") return this._onEvent(siteId, devKey, msg);
    if (channel === "lwt") return this._onLwt(siteId, devKey, msg);
  }

  // ---------- AUTO-DISCOVERY: device က ကိုယ့် traits ကိုယ်ကြေညာ ----------
  async _onConfig(siteId, devKey, msg) {
    const conf = JSON.parse(msg); // {name, type, traits}
    const { rows } = await this.pool.query(
      `SELECT owner_id FROM gh_sites WHERE id=$1`,
      [siteId]
    );
    if (!rows.length) {
      return console.warn(`[mqtt] မသိတဲ့ site '${siteId}' — config လျစ်လျူရှု`);
    }
    const deviceId = await this.registry.register(
      rows[0].owner_id,
      siteId,
      "mqtt",
      {
        ref: { siteId, devKey },
        name: conf.name || devKey,
        type: conf.type || "sensor",
        traits: conf.traits || {},
      },
      devKey
    );
    console.log(`🔌 [mqtt] auto-registered: ${deviceId}`);
  }

  // ---------- STATE: cache + time-series ingest + rules trigger ----------
  async _onState(siteId, devKey, msg) {
    const { values = {} } = JSON.parse(msg);
    const key = this._key(siteId, devKey);
    const prev = this.cache.get(key) || {};
    this.cache.set(key, {
      online: true,
      values: { ...prev.values, ...values },
      ts: Date.now(),
    });

    const deviceId = this._deviceId(siteId, devKey);

    await this.pool.query(
      `UPDATE gh_devices SET is_online=true, last_seen=now() WHERE id=$1`,
      [deviceId]
    );

    // Ingestor: numeric values → sensor_readings
    for (const [trait, v] of Object.entries(values)) {
      if (typeof v === "number") {
        await this.pool.query(
          `INSERT INTO sensor_readings (device_id, trait, value) VALUES ($1,$2,$3)`,
          [deviceId, trait, v]
        );
      }
    }

    // Rules Engine ကိုအကြောင်းကြား
    if (this.onStateChange) this.onStateChange(deviceId, values);
  }

  async _onEvent(siteId, devKey, msg) {
    const ev = JSON.parse(msg);
    const deviceId = this._deviceId(siteId, devKey);
    await this.pool.query(
      `INSERT INTO gh_events (device_id, type, payload) VALUES ($1,$2,$3)`,
      [deviceId, ev.type || "event", ev]
    );
    if (this.onStateChange) this.onStateChange(deviceId, { __event: ev });
  }

  async _onLwt(siteId, devKey, msg) {
    if (msg !== "offline") return;
    const key = this._key(siteId, devKey);
    const prev = this.cache.get(key) || {};
    this.cache.set(key, { ...prev, online: false });
    const deviceId = this._deviceId(siteId, devKey);
    await this.pool.query(
      `UPDATE gh_devices SET is_online=false WHERE id=$1`,
      [deviceId]
    );
    await this.pool.query(
      `INSERT INTO gh_events (device_id, type) VALUES ($1,'offline')`,
      [deviceId]
    );
    console.log(`⚠️  [mqtt] ${deviceId} OFFLINE (LWT)`);
  }

  // ---------- Connector interface ----------
  async listDevices() {
    return [...this.cache.entries()].map(([key, s]) => {
      const [siteId, devKey] = key.split("/");
      return {
        ref: { siteId, devKey },
        name: devKey,
        type: "sensor",
        online: s.online,
      };
    });
  }

  async getState(device) {
    const { siteId, devKey } = device.connector_ref;
    const s = this.cache.get(this._key(siteId, devKey));
    if (!s) return { online: false };
    const stale = Date.now() - s.ts > 90000; // 90s ကျော် state မလာရင် stale
    return { online: s.online && !stale, values: s.values };
  }

  async execute(device, command, params) {
    const { siteId, devKey } = device.connector_ref;
    const topic = `gw/${siteId}/${devKey}/cmd`;
    this.client.publish(topic, JSON.stringify({ command, params }), { qos: 1 });
    return { sent: true, topic };
  }

  async getStreamUrl() {
    throw new Error("mqtt device မှာ video stream မရှိပါ");
  }
}

module.exports = { MqttConnector };
