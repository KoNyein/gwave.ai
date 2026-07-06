#!/usr/bin/env node
/**
 * Device simulator: publishes realistic fake telemetry so the /farm
 * dashboard works without hardware, and echoes cmd → state so /home
 * switch toggles confirm.
 *
 * 1. Register devices at /farm/devices and copy each device's id + secret.
 * 2. Fill in DEVICES below (or pass a JSON file: node simulate-devices.mjs devices.json)
 * 3. node scripts/simulate-devices.mjs   (MQTT_URL env optional)
 *
 * devices.json format:
 * [
 *   { "id": "<uuid>", "secret": "...", "kind": "sensor" },
 *   { "id": "<uuid>", "secret": "...", "kind": "switch" }
 * ]
 */

import { readFileSync } from "node:fs";

import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const INTERVAL_MS = 5000;

/** Fill these in, or pass a JSON file as argv[2]. */
let DEVICES = [
  // { id: "00000000-0000-0000-0000-000000000000", secret: "...", kind: "sensor" },
];

if (process.argv[2]) {
  DEVICES = JSON.parse(readFileSync(process.argv[2], "utf8"));
}
if (DEVICES.length === 0) {
  console.error(
    "No devices configured. Edit DEVICES in this script or pass a JSON file.",
  );
  process.exit(1);
}

const client = mqtt.connect(MQTT_URL);

// Sensor values drift smoothly around a setpoint.
const sensorState = new Map();
function drift(deviceId, metric, base, spread, decimals = 2) {
  const key = `${deviceId}:${metric}`;
  const current = sensorState.get(key) ?? base;
  const next = Math.max(
    base - spread,
    Math.min(base + spread, current + (Math.random() - 0.5) * spread * 0.4),
  );
  sensorState.set(key, next);
  return Number(next.toFixed(decimals));
}

const switchState = new Map();

client.on("connect", () => {
  console.log("simulator connected:", MQTT_URL);

  for (const device of DEVICES) {
    if (device.kind === "switch") {
      switchState.set(device.id, { power: "off" });
      client.subscribe(`gwave/${device.id}/cmd`);
      // Announce initial state.
      client.publish(
        `gwave/${device.id}/state`,
        JSON.stringify({ secret: device.secret, state: { power: "off" } }),
      );
    }
  }

  setInterval(() => {
    for (const device of DEVICES) {
      if (device.kind !== "sensor") continue;
      const metrics = {
        ph: drift(device.id, "ph", 6.0, 0.4),
        ec: drift(device.id, "ec", 1.6, 0.3),
        air_temp: drift(device.id, "air_temp", 27, 3, 1),
        water_temp: drift(device.id, "water_temp", 20, 2, 1),
        humidity: drift(device.id, "humidity", 62, 8, 0),
        vpd: drift(device.id, "vpd", 1.1, 0.3),
      };
      client.publish(
        `gwave/${device.id}/telemetry`,
        JSON.stringify({ secret: device.secret, metrics }),
      );
      console.log("telemetry", device.id.slice(0, 8), JSON.stringify(metrics));
    }
  }, INTERVAL_MS);
});

client.on("message", (topic, payload) => {
  const match = topic.match(/^gwave\/([0-9a-f-]{36})\/cmd$/);
  if (!match) return;
  const device = DEVICES.find((entry) => entry.id === match[1]);
  if (!device) return;

  try {
    const command = JSON.parse(payload.toString());
    const state = { ...switchState.get(device.id), ...command };
    switchState.set(device.id, state);
    console.log("cmd", device.id.slice(0, 8), JSON.stringify(command));
    // Echo the new state back after a moment, like real firmware would.
    setTimeout(() => {
      client.publish(
        `gwave/${device.id}/state`,
        JSON.stringify({ secret: device.secret, state }),
      );
    }, 400);
  } catch {
    // ignore malformed commands
  }
});
