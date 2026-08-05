/**
 * Config loader — file (config.json, optional) + env overrides.
 * Production runs the container with --env-file /etc/gwave-web.env, so every
 * secret stays on the box exactly like the other gwave services; a config
 * file is only for local dev. Env always wins.
 *
 * Env vars:
 *   GH_PORT                 API port (default 4000)
 *   GH_DATABASE_URL         postgres://user:pass@host:5432/gwave
 *   GH_PROXY_KEY            shared secret the Next.js proxy must send
 *   GH_BROKER_PORT          embedded MQTT broker port (default 1883, 0=off)
 *   GH_MQTT_INTERNAL_PASSWORD  the server's own broker login (required to
 *                              enable the broker — refuse to run open)
 *   GH_MEDIAMTX_API         e.g. http://127.0.0.1:9997
 *   GH_MEDIAMTX_PUBLIC      public base for HLS, e.g. https://gwave.cc/hls
 *   GH_TUYA_BASE / GH_TUYA_ID / GH_TUYA_SECRET   optional Tuya cloud
 */

const fs = require("fs");
const path = require("path");

function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"),
    );
  } catch {
    /* config.json is optional — env-only in production */
  }
  const e = process.env;
  const cfg = {
    port: Number(e.GH_PORT) || file.port || 4000,
    healthPollSeconds: file.healthPollSeconds || 30,
    proxyKey: e.GH_PROXY_KEY || file.proxyKey || null,
    postgres: e.GH_DATABASE_URL
      ? { connectionString: e.GH_DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : file.postgres,
    broker: {
      port: e.GH_BROKER_PORT !== undefined
        ? Number(e.GH_BROKER_PORT)
        : (file.broker && file.broker.port) || 1883,
      internalPassword:
        e.GH_MQTT_INTERNAL_PASSWORD ||
        (file.broker && file.broker.internalPassword) ||
        null,
    },
    mediamtx: {
      apiUrl: e.GH_MEDIAMTX_API || (file.mediamtx && file.mediamtx.apiUrl) ||
        "http://127.0.0.1:9997",
      publicBase: e.GH_MEDIAMTX_PUBLIC ||
        (file.mediamtx && (file.mediamtx.publicBase || file.mediamtx.publicHost)) ||
        null,
      hlsPort: (file.mediamtx && file.mediamtx.hlsPort) || 8888,
      webrtcPort: (file.mediamtx && file.mediamtx.webrtcPort) || 8889,
    },
    tuya: {
      apiBase: e.GH_TUYA_BASE || (file.tuya && file.tuya.apiBase) ||
        "https://openapi.tuyaeu.com",
      accessId: e.GH_TUYA_ID || (file.tuya && file.tuya.accessId) || null,
      accessSecret: e.GH_TUYA_SECRET || (file.tuya && file.tuya.accessSecret) || null,
    },
  };
  // The engine's own MQTT client talks to the embedded broker over loopback.
  cfg.mqtt = file.mqtt || {
    url: `mqtt://127.0.0.1:${cfg.broker.port || 1883}`,
    username: "gwave-internal",
    password: cfg.broker.internalPassword,
  };
  return cfg;
}

module.exports = { loadConfig };
