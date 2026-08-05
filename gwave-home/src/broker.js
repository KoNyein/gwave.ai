/**
 * Embedded MQTT broker (aedes) — one container serves API + broker, no
 * external EMQX/Mosquitto to operate. ESP32/ESPHome nodes connect straight
 * to gwave.cc:1883 with per-device credentials from /api/provision.
 *
 * Auth model:
 *  - "gwave-internal" + GH_MQTT_INTERNAL_PASSWORD = the engine's own client
 *    (full access).
 *  - Every other client must match a gh_device_credentials row (sha256), and
 *    its ACL is pinned to its OWN topics: username "{site}_{key}" may only
 *    publish/subscribe gw/{site}/{key}/... — a leaked credential cannot spy
 *    on or drive any other device.
 *  - The broker refuses to start without an internal password: an open
 *    broker on a public port is worse than no broker.
 */

const net = require("net");
const crypto = require("crypto");
const { Aedes } = require("aedes");

async function startBroker(cfg, pool) {
  const port = cfg.broker.port;
  if (!port) {
    console.log("📡 [broker] disabled (GH_BROKER_PORT=0)");
    return null;
  }
  if (!cfg.broker.internalPassword) {
    console.log("📡 [broker] GH_MQTT_INTERNAL_PASSWORD not set — broker stays OFF");
    return null;
  }

  // aedes 1.x: createBroker() runs the async persistence setup — a bare
  // `new Aedes()` accepts TCP but never CONNACKs.
  const aedes = await Aedes.createBroker();

  aedes.authenticate = (client, username, password, done) => {
    const pass = password ? password.toString() : "";
    if (username === "gwave-internal") {
      return done(null, pass === cfg.broker.internalPassword);
    }
    const hash = crypto.createHash("sha256").update(pass).digest("hex");
    pool
      .query(
        `SELECT 1 FROM gh_device_credentials
         WHERE mqtt_username=$1 AND mqtt_password_hash=$2`,
        [username, hash],
      )
      .then((r) => done(null, r.rows.length > 0))
      .catch(() => done(null, false));
  };

  const ownsTopic = (client, topic) => {
    if (client._authUsername === "gwave-internal") return true;
    // "{site}_{key}" → gw/{site}/{key}/...
    const u = String(client._authUsername || "");
    const i = u.indexOf("_");
    if (i <= 0) return false;
    const prefix = `gw/${u.slice(0, i)}/${u.slice(i + 1)}/`;
    return topic.startsWith(prefix);
  };

  // aedes doesn't hand username to authorize hooks — stash it at auth time.
  const origAuth = aedes.authenticate;
  aedes.authenticate = (client, username, password, done) => {
    client._authUsername = username;
    origAuth(client, username, password, done);
  };

  aedes.authorizePublish = (client, packet, done) => {
    done(ownsTopic(client, packet.topic) ? null : new Error("forbidden"));
  };
  aedes.authorizeSubscribe = (client, sub, done) => {
    // Internal client subscribes wildcards; devices only their own subtree.
    if (client._authUsername === "gwave-internal") return done(null, sub);
    done(ownsTopic(client, sub.topic.replace(/[#+].*$/, "")) ? null : new Error("forbidden"), sub);
  };

  const server = net.createServer(aedes.handle);
  server.listen(port, () => {
    console.log(`📡 [broker] MQTT listening on :${port}`);
  });
  return { aedes, server };
}

module.exports = { startBroker };
