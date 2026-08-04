/// Data-driven weapon stats (blueprint §2.3). Client renders/predicts with
/// these and the server validates with the SAME numbers — that is the whole
/// point of this file living in shared/.

export type WeaponId = "rifle" | "pistol";

export type WeaponStats = {
  dmg: number;
  /// Rounds per minute
  rpm: number;
  mag: number;
  reserve: number;
  /// Reload time (s)
  reload: number;
  spreadHip: number;
  spreadADS: number;
  adsFov: number;
  recoil: number;
};

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  rifle: {
    dmg: 26,
    rpm: 570,
    mag: 30,
    reserve: 90,
    reload: 1.9,
    spreadHip: 0.018,
    spreadADS: 0.0025,
    adsFov: 42,
    recoil: 0.014,
  },
  pistol: {
    dmg: 18,
    rpm: 300,
    mag: 12,
    reserve: 48,
    reload: 1.4,
    spreadHip: 0.012,
    spreadADS: 0.004,
    adsFov: 55,
    recoil: 0.01,
  },
};

export const HEADSHOT_MULT = 2.5;

/// CS-style 30-shot spray pattern: [vertical, horizontal] per shot, scaled by
/// the weapon's `recoil`. First shots climb, then the pattern drifts.
export const SPRAY_PATTERN: readonly [number, number][] = Array.from(
  { length: 30 },
  (_, i) => {
    const v = i < 8 ? 1 + i * 0.25 : 3 - Math.min(1.4, (i - 8) * 0.08);
    const h = i < 8 ? 0 : Math.sin((i - 8) * 0.55) * 1.6;
    return [v, h] as [number, number];
  },
);
