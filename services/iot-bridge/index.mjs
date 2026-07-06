/**
 * gwave.ai IoT bridge: MQTT ⇄ Supabase.
 *
 * Responsibilities:
 *  - subscribe to gwave/+/telemetry — validate the device secret, insert
 *    sensor_readings, refresh devices.online/last_seen, evaluate automation
 *    rules (queue action commands + insert alerts)
 *  - subscribe to gwave/+/state — mirror the reported state onto the device
 *    row (confirms optimistic UI toggles)
 *  - watch device_commands (realtime + polling fallback) — publish pending
 *    commands to <topic>/cmd and mark them sent
 *  - run scene schedules once per minute
 *  - mark devices offline after OFFLINE_AFTER_MS without telemetry
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MQTT_URL
 * (e.g. mqtt://emqx:1883), optional MQTT_USERNAME/MQTT_PASSWORD, TZ.
 */

import { createClient } from "@supabase/supabase-js";
import mqtt from "mqtt";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const OFFLINE_AFTER_MS = 90_000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const client = mqtt.connect(MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 2000,
});

/** device id → { topic, secret, owner_id, type } */
const deviceCache = new Map();

async function refreshDeviceCache() {
  const { data, error } = await supabase
    .from("devices")
    .select("id, topic, secret, owner_id, type");
  if (error) {
    console.error("device cache refresh failed:", error.message);
    return;
  }
  deviceCache.clear();
  for (const device of data ?? []) deviceCache.set(device.id, device);
}

function log(...parts) {
  console.log(new Date().toISOString(), ...parts);
}

// ---------------------------------------------------------------------------
// MQTT ingest
// ---------------------------------------------------------------------------

client.on("connect", () => {
  log("mqtt connected:", MQTT_URL);
  client.subscribe(["gwave/+/telemetry", "gwave/+/state"]);
});

client.on("error", (error) => log("mqtt error:", error.message));

client.on("message", async (topic, payload) => {
  const match = topic.match(/^gwave\/([0-9a-f-]{36})\/(telemetry|state)$/);
  if (!match) return;
  const [, deviceId, kind] = match;

  let body;
  try {
    body = JSON.parse(payload.toString());
  } catch {
    return;
  }

  let device = deviceCache.get(deviceId);
  if (!device) {
    await refreshDeviceCache();
    device = deviceCache.get(deviceId);
    if (!device) return;
  }
  if (body.secret !== device.secret) {
    log("rejected message with bad secret for", deviceId);
    return;
  }

  if (kind === "telemetry") {
    await handleTelemetry(device, body);
  } else {
    await handleState(device, body);
  }
});

async function handleTelemetry(device, body) {
  const metrics = body.metrics ?? {};
  const rows = Object.entries(metrics)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([metric, value]) => ({
      device_id: device.id,
      metric,
      value: Number(value),
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("sensor_readings").insert(rows);
    if (error) log("insert readings failed:", error.message);
  }

  await supabase
    .from("devices")
    .update({ online: true, last_seen: new Date().toISOString() })
    .eq("id", device.id);

  for (const row of rows) {
    await evaluateRules(device, row.metric, row.value);
  }
}

async function handleState(device, body) {
  const state = body.state ?? {};
  await supabase
    .from("devices")
    .update({
      state,
      online: true,
      last_seen: new Date().toISOString(),
    })
    .eq("id", device.id);
  // Any in-flight commands for this device are now confirmed.
  await supabase
    .from("device_commands")
    .update({ status: "acked" })
    .eq("device_id", device.id)
    .eq("status", "sent");
}

// ---------------------------------------------------------------------------
// Automation rules
// ---------------------------------------------------------------------------

const COMPARATORS = {
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

function inTimeWindow(rule, now) {
  if (!rule.time_start || !rule.time_end) return true;
  const current = now.toTimeString().slice(0, 5);
  const start = rule.time_start.slice(0, 5);
  const end = rule.time_end.slice(0, 5);
  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end; // overnight window
}

async function evaluateRules(device, metric, value) {
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("trigger_device_id", device.id)
    .eq("metric", metric)
    .eq("enabled", true);

  const now = new Date();
  for (const rule of rules ?? []) {
    if (!COMPARATORS[rule.comparator]?.(value, Number(rule.threshold))) {
      continue;
    }
    if (!inTimeWindow(rule, now)) continue;
    if (
      rule.last_triggered_at &&
      now - new Date(rule.last_triggered_at) <
        rule.cooldown_minutes * 60_000
    ) {
      continue;
    }

    log(`rule "${rule.name}" triggered (${metric} ${value})`);
    await supabase
      .from("automation_rules")
      .update({ last_triggered_at: now.toISOString() })
      .eq("id", rule.id);

    if (rule.action_device_id && Object.keys(rule.action ?? {}).length > 0) {
      await supabase.from("device_commands").insert({
        device_id: rule.action_device_id,
        command: rule.action,
      });
    }

    await supabase.from("alerts").insert({
      owner_id: rule.owner_id,
      device_id: device.id,
      rule_id: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${metric} = ${value} (threshold ${rule.comparator} ${rule.threshold})`,
    });
  }
}

// ---------------------------------------------------------------------------
// Command dispatch (realtime + polling fallback)
// ---------------------------------------------------------------------------

async function dispatchPendingCommands() {
  const { data: pending } = await supabase
    .from("device_commands")
    .select("id, device_id, command")
    .eq("status", "pending")
    .order("created_at")
    .limit(50);

  for (const command of pending ?? []) {
    let device = deviceCache.get(command.device_id);
    if (!device) {
      await refreshDeviceCache();
      device = deviceCache.get(command.device_id);
    }
    if (!device) continue;

    client.publish(
      `${device.topic}/cmd`,
      JSON.stringify(command.command),
      { qos: 1 },
    );
    await supabase
      .from("device_commands")
      .update({ status: "sent" })
      .eq("id", command.id);
    log("command sent to", device.topic, JSON.stringify(command.command));
  }
}

supabase
  .channel("bridge:commands")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "device_commands" },
    () => void dispatchPendingCommands(),
  )
  .subscribe();

// ---------------------------------------------------------------------------
// Scene schedules (checked once a minute) + offline sweep
// ---------------------------------------------------------------------------

async function runDueSchedules() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const isoWeekday = ((now.getDay() + 6) % 7) + 1; // 1 = Monday

  const { data: schedules } = await supabase
    .from("scene_schedules")
    .select("id, scene_id, run_at, days_of_week, last_run_at")
    .eq("enabled", true);

  for (const schedule of schedules ?? []) {
    if (schedule.run_at.slice(0, 5) !== currentTime) continue;
    if (!schedule.days_of_week.includes(isoWeekday)) continue;
    if (
      schedule.last_run_at &&
      now - new Date(schedule.last_run_at) < 60_000
    ) {
      continue;
    }

    const { data: scene } = await supabase
      .from("scenes")
      .select("name, actions")
      .eq("id", schedule.scene_id)
      .maybeSingle();
    if (!scene) continue;

    log(`schedule fired: scene "${scene.name}"`);
    const actions = scene.actions ?? [];
    if (actions.length > 0) {
      await supabase.from("device_commands").insert(
        actions.map((action) => ({
          device_id: action.device_id,
          command: action.command,
        })),
      );
    }
    await supabase
      .from("scene_schedules")
      .update({ last_run_at: now.toISOString() })
      .eq("id", schedule.id);
  }
}

async function sweepOfflineDevices() {
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS).toISOString();
  await supabase
    .from("devices")
    .update({ online: false })
    .eq("online", true)
    .lt("last_seen", cutoff);
}

// ---------------------------------------------------------------------------

await refreshDeviceCache();
setInterval(refreshDeviceCache, 60_000);
setInterval(dispatchPendingCommands, 5_000);
setInterval(runDueSchedules, 60_000);
setInterval(sweepOfflineDevices, 30_000);
log("iot-bridge running");
