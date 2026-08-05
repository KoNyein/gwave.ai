// config.js — drone + controller config (FeelFPV-parity defaults)
export const DEFAULT_CONFIG = {
  // Actual Rates (deg/s) — per axis
  rates: {
    roll:  { centerSens: 200, maxRate: 600, expo: 0.40 },
    pitch: { centerSens: 200, maxRate: 600, expo: 0.40 },
    yaw:   { centerSens: 200, maxRate: 600, expo: 0.40 },
  },
  massG: 650,        // g
  camAngle: 30,      // ° uptilt
  camFov: 70,        // °
  thrPower: 100,     // % thrust scale
  flightMode: 'ACRO',// ACRO | ANGLE
  // controller
  halfThrottle: false,
  invPitch: false, invRoll: false, invYaw: false, invThrottle: false,
  bindings: { pitch: 3, roll: 2, yaw: 0, throttle: 1 }, // gamepad axis index (Mode 2 default)
};

const KEY = 'gwave_drone_cfg_v1';

export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return deepMerge(structuredClone(DEFAULT_CONFIG), JSON.parse(raw));
  } catch (_) { /* artifacts/no-storage env → defaults */ }
  return structuredClone(DEFAULT_CONFIG);
}
export function saveConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); return true; }
  catch (_) { return false; }
}
function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]))
      base[k] = deepMerge(base[k] ?? {}, over[k]);
    else base[k] = over[k];
  }
  return base;
}
