/// Movement + sim constants shared by client prediction and server sim
/// (blueprint §4 — the two must integrate identically).

export const TICK_RATE = 30;
export const SNAPSHOT_RATE = 20;
export const INPUT_RATE = 60;

export const MOVE = {
  walk: 4.2,
  run: 6.4,
  crouchScale: 0.55,
  adsScale: 0.72,
  jumpVel: 5.6,
  gravity: 18,
  /// Kinematic capsule (blueprint §2.2)
  capsuleRadius: 0.35,
  capsuleHeight: 1.7,
  eyeHeight: 1.55,
  crouchEyeHeight: 1.05,
} as const;

export const MAX_HP = 100;
export const RESPAWN_S = 4;
export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
export const TDM_TARGET = 50;

export const MAP_HALF = 90; // playable half-extent (m)
