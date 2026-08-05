/**
 * ============================================================
 * TRAITS — Unified Device Model (v2: Smart Home + Farm ပါပြီ)
 * ------------------------------------------------------------
 * Device တစ်ခုက "ဘာလုပ်နိုင်လဲ" ကို standard vocabulary နဲ့
 * ကြေညာတယ်။ Frontend က brand မသိဘဲ traits ကိုပဲကြည့်တယ်။
 * ============================================================
 */

const TRAITS = {
  // ---------- Camera ----------
  "camera.live":   { params: { protocols: "array" }, commands: ["getStreamUrl"] },
  "camera.ptz":    { params: {}, commands: ["move"] },
  "camera.motion": { params: { events: "boolean" }, commands: [] },
  "camera.record": { params: { retention_days: "number" }, commands: ["listRecordings"] },

  // ---------- Sensors (read-only — value က state ထဲမှာလာတယ်) ----------
  "sensor.temperature":   { params: { unit: "string" }, commands: [] },
  "sensor.humidity":      { params: {}, commands: [] },
  "sensor.soil_moisture": { params: {}, commands: [] },
  "sensor.water_level":   { params: {}, commands: [] },
  "sensor.ph":            { params: {}, commands: [] },
  "sensor.ec":            { params: {}, commands: [] },
  "sensor.light":         { params: { unit: "string" }, commands: [] },
  "sensor.contact":       { params: {}, commands: [] },   // တံခါး sensor

  // ---------- Actuators ----------
  "power.onoff":     { params: {}, commands: ["setOn"] },
  "actuator.relay":  { params: { channels: "number" }, commands: ["setOn"] },
  "actuator.dimmer": { params: { min: "number", max: "number" }, commands: ["setLevel"] },
  "thermostat.target": { params: { min: "number", max: "number" }, commands: ["setTarget"] },
};

function validateTraits(traits) {
  const unknown = Object.keys(traits).filter((t) => !TRAITS[t]);
  if (unknown.length) throw new Error(`မသိတဲ့ trait: ${unknown.join(", ")}`);
  return true;
}

function commandAllowed(traits, command) {
  return Object.keys(traits).some((t) =>
    (TRAITS[t]?.commands || []).includes(command)
  );
}

/** state payload ထဲက sensor value တွေကို trait အလိုက်ခွဲထုတ် */
function sensorTraitsIn(traits) {
  return Object.keys(traits).filter((t) => t.startsWith("sensor."));
}

module.exports = { TRAITS, validateTraits, commandAllowed, sensorTraitsIn };
