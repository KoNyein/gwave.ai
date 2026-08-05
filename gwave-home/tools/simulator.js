/**
 * ============================================================
 * GWAVE Device Simulator — hardware မဝယ်ခင် engine စမ်းရန်
 * ------------------------------------------------------------
 * ESP32 farm node အတုတစ်လုံးအဖြစ် ဟန်ဆောင်တယ်:
 *  - config ကြေညာ (auto-discovery စမ်း)
 *  - 3s တစ်ခါ soil moisture တင် (တဖြည်းဖြည်းခြောက်သွားအောင်လျှော့)
 *  - cmd topic နားထောင် — pump ဖွင့်ခိုင်းရင် moisture ပြန်တက်
 * Run: node tools/simulator.js [mqtt-url]
 * ============================================================
 */
const mqtt = require("mqtt");

const url = process.argv[2] || "mqtt://localhost:1883";
const SITE = "farm01";
const DEV = "soil1";
const base = `gw/${SITE}/${DEV}`;

let moisture = 45;
let pumpOn = false;

const client = mqtt.connect(url, {
  will: { topic: `${base}/lwt`, payload: "offline" },
});

client.on("connect", () => {
  console.log(`🤖 Simulator ချိတ်ပြီး (${url}) — device: ${SITE}/${DEV}`);
  client.publish(`${base}/lwt`, "online");
  client.publish(
    `${base}/config`,
    JSON.stringify({
      name: "Soil Node 1 (sim)",
      type: "sensor",
      traits: {
        "sensor.soil_moisture": {},
        "sensor.temperature": { unit: "C" },
        "actuator.relay": { channels: 1 },
      },
    }),
    { retain: true }
  );
  client.subscribe(`${base}/cmd`);

  setInterval(() => {
    moisture = pumpOn
      ? Math.min(70, moisture + 8)      // ရေပေးနေရင် ပြန်စို
      : Math.max(10, moisture - 3);     // မပေးရင် တဖြည်းဖြည်းခြောက်
    const state = {
      values: {
        "sensor.soil_moisture": Number(moisture.toFixed(1)),
        "sensor.temperature": 27 + Math.random() * 2,
        "actuator.relay": pumpOn,
      },
    };
    client.publish(`${base}/state`, JSON.stringify(state));
    console.log(`   💧 moisture=${moisture.toFixed(1)}%  pump=${pumpOn ? "ON" : "OFF"}`);
  }, 3000);
});

client.on("message", (topic, payload) => {
  const { command, params } = JSON.parse(payload.toString());
  console.log(`   📥 CMD ရောက်လာသည်: ${command}`, params);
  if (command === "setOn") pumpOn = !!params.on;
});
