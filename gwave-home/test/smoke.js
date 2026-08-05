/**
 * ============================================================
 * SMOKE TEST — engine end-to-end without Postgres or hardware
 * ------------------------------------------------------------
 * Run: node test/smoke.js     (exits 0 on pass, 1 on fail)
 *
 * Flow (matches src/server.js wiring exactly):
 *  1. aedes broker on :18831
 *  2. MqttConnector.init(registry, mockPool) + RulesEngine
 *  3. fake ESP32 announces itself on .../config  → auto-register
 *  4. fake ESP32 publishes soil_moisture=22      → ingest
 *  5. rule "moisture < 30 → pump ON" fires       → cmd on pump topic ✅
 * ============================================================
 */

const net = require("net");
const { Aedes } = require("aedes");
const mqtt = require("mqtt");

const { MqttConnector } = require("../src/connectors/mqtt");
const { RulesEngine } = require("../src/rules-engine");
const { Notifier } = require("../src/notify");
const { Registry } = require("../src/registry");

const PORT = 18831;

const RULE = {
  id: "rule_pump_auto",
  site_id: "farm01",
  name: "မြေခြောက်ရင် ရေပေး",
  enabled: true,
  definition: {
    trigger: {
      type: "state",
      device: "dev_farm01_soil1",
      trait: "sensor.soil_moisture",
      condition: "lt",
      value: 30,
    },
    conditions: [],
    actions: [
      { type: "device", device: "dev_farm01_pump1", command: "setOn", params: { on: true } },
      { type: "notify", message: "Zone 1 ရေစက်ဖွင့်လိုက်ပါပြီ" },
    ],
    cooldown_seconds: 60,
  },
};
const PUMP = {
  id: "dev_farm01_pump1",
  owner_id: "test-owner-uuid",
  connector: "mqtt",
  connector_ref: { siteId: "farm01", devKey: "pump1" },
  traits: { "actuator.relay": { channels: 1 } },
};

const mockPool = {
  async query(sql, params) {
    if (sql.includes("FROM gh_rules")) return { rows: [RULE] };
    if (sql.includes("FROM gh_devices")) {
      return { rows: params && params[0] === PUMP.id ? [PUMP] : [] };
    }
    if (sql.includes("FROM gh_sites")) {
      return { rows: [{ owner_id: "test-owner-uuid" }] };
    }
    return { rows: [], rowCount: 1 };
  },
};

async function main() {
  // aedes 1.x: must use the async factory or clients never get a CONNACK
  const aedes = await Aedes.createBroker();
  await new Promise((res) => net.createServer(aedes.handle).listen(PORT, res));
  console.log(`1️⃣  broker :${PORT} ✅`);

  const cfg = { mqtt: { url: `mqtt://127.0.0.1:${PORT}` } };
  const connector = new MqttConnector(cfg);
  const registry = new Registry(mockPool, { mqtt: connector });
  const notifier = new Notifier(mockPool, {});
  const engine = new RulesEngine(mockPool, registry, notifier);
  connector.init(registry, mockPool);
  connector.onStateChange = (id, values) =>
    engine.onStateChange(id, values).catch((e) => console.error(e));
  await engine.reload();
  await new Promise((r) => setTimeout(r, 400));
  console.log("2️⃣  engine wired ✅");

  const esp = mqtt.connect(`mqtt://127.0.0.1:${PORT}`);
  await new Promise((r) => esp.on("connect", r));
  let cmdReceived = null;
  esp.subscribe("gw/farm01/pump1/cmd");
  esp.on("message", (t, buf) => {
    if (t === "gw/farm01/pump1/cmd") cmdReceived = JSON.parse(buf.toString());
  });

  esp.publish(
    "gw/farm01/soil1/config",
    JSON.stringify({ name: "Soil 1", type: "iot_node", traits: { "sensor.soil_moisture": {} } }),
  );
  await new Promise((r) => setTimeout(r, 400));
  console.log("3️⃣  auto-discovery config sent ✅");

  esp.publish(
    "gw/farm01/soil1/state",
    JSON.stringify({ values: { "sensor.soil_moisture": 22 } }),
  );
  console.log("4️⃣  soil_moisture=22 state sent");

  await new Promise((r) => setTimeout(r, 1500));
  if (cmdReceived && cmdReceived.params && cmdReceived.params.on === true) {
    console.log(`5️⃣  rule fired → pump cmd received ✅ ${JSON.stringify(cmdReceived)}`);
    process.exit(0);
  }
  console.error("❌ pump cmd never arrived", cmdReceived);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
