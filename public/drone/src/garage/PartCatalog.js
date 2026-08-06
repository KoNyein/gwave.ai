// garage/PartCatalog.js — part တိုင်း DronePhysics ကို တကယ်ထိ (GAME_DESIGN_ANALYSIS §4)
// stat card ပေါ်ကဂဏန်း = physics တွက်တဲ့ဂဏန်း အတိအကျ (physics honesty rule)

export const PARTS = {
  propeller: {
    label: 'Propellers',
    items: {
      blade2: { name: '2-Blade (Race)', thrust: 0.92, drag: 0.78, yawK: 0.85, sag: 0.85,
        desc: 'Top speed ↑ · efficiency ↑ · grip ↓' },
      blade3: { name: '3-Blade', thrust: 1.0, drag: 1.0, yawK: 1.0, sag: 1.0,
        desc: 'Balanced (default)' },
      blade4: { name: '4-Blade (Freestyle)', thrust: 1.07, drag: 1.28, yawK: 1.15, sag: 1.18,
        desc: 'Grip/authority ↑ · drag ↑ · battery ↓' },
      blade7: { name: 'Seven Blade (Cine)', thrust: 1.12, drag: 1.55, yawK: 1.3, sag: 1.35,
        desc: 'Smooth ↑↑ · drag ↑↑ · အသံညက်' },
    },
  },
  motor: {
    label: 'Motors',
    items: {
      kv1700: { name: '1700KV (Efficient)', thrust: 0.88, tau: 0.045, sag: 0.8,
        desc: 'Flight time ↑ · punch ↓' },
      kv1900: { name: '1900KV', thrust: 1.0, tau: 0.035, sag: 1.0,
        desc: 'Balanced (default)' },
      kv2400: { name: '2400KV (Race)', thrust: 1.18, tau: 0.026, sag: 1.35,
        desc: 'Punch ↑↑ · spool မြန် · battery ↓↓' },
    },
  },
  battery: {
    label: 'Battery',
    items: {
      s4_1500: { name: '4S 1500mAh', massG: 175, volt: 16.8, thrust: 0.78, capacity: 1.0,
        desc: 'ပေါ့ · အားနည်း · smooth' },
      s6_1100: { name: '6S 1100mAh', massG: 205, volt: 25.2, thrust: 1.0, capacity: 1.0,
        desc: 'Race standard (default)' },
      s6_1800: { name: '6S 1800mAh', massG: 290, volt: 25.2, thrust: 1.0, capacity: 1.65,
        desc: 'Flight time ↑↑ · လေး · handling ထိုင်' },
    },
  },
  frame: {
    label: 'Frame',
    items: {
      f3: { name: '3" Micro', baseMassG: 240, armLen: 0.078, inertia: 0.42, drag: 0.75,
        desc: 'အတွင်းပိုင်း scout · သွက် · လေထိခံ' },
      f5: { name: '5" Freestyle', baseMassG: 445, armLen: 0.115, inertia: 1.0, drag: 1.0,
        desc: 'Standard (default)' },
      f7: { name: '7" Long-range', baseMassG: 620, armLen: 0.152, inertia: 1.7, drag: 1.25,
        desc: 'တည်ငြိမ် · အဝေးပျံ · နှေး' },
    },
  },
};

export const DEFAULT_BUILD = {
  propeller: 'blade3', motor: 'kv1900', battery: 's6_1100', frame: 'f5',
  colors: { frame: '#1a1a1e', props: '#35e04d', battery: '#cc2233' },
  name: 'My Build',
};

// build → physics modifiers + spec sheet (stat = physics တွက်ချက် တစ်ခုတည်း)
export function computeBuild(build) {
  const prop = PARTS.propeller.items[build.propeller];
  const mot = PARTS.motor.items[build.motor];
  const bat = PARTS.battery.items[build.battery];
  const fr = PARTS.frame.items[build.frame];

  const massG = fr.baseMassG + bat.massG;
  const massKg = massG / 1000;
  const thrustMul = prop.thrust * mot.thrust * bat.thrust;
  const baseTWR = 6.0;                        // 5" default reference
  const maxThrustN = 0.65 * 9.81 * baseTWR * thrustMul; // absolute N (mass-independent!)
  const twr = maxThrustN / (massKg * 9.81);
  const dragQuad = 0.65 * prop.drag * fr.drag;
  // top speed est: thrust*sin(45°) = dragQuad*v² (physics drag formula scale)
  const topSpeed = Math.sqrt((maxThrustN * 0.7) / (dragQuad * 0.01 * massKg / 0.65)) * 0.28;
  const sagMul = prop.sag * mot.sag;
  const flightTime = 240 * bat.capacity / (sagMul * thrustMul); // s (hover baseline)
  const agility = (maxThrustN * fr.armLen) / (0.004 * fr.inertia) / 1100; // default build = 1.0

  return {
    physics: {
      massG, maxThrustN, motorTau: mot.tau,
      dragQuad, armLen: fr.armLen, inertiaMul: fr.inertia,
      yawTorqueK: 0.012 * prop.yawK,
      voltFull: bat.volt, sagMul, capacity: bat.capacity,
    },
    spec: {
      massG, twr: +twr.toFixed(1),
      topSpeed: Math.round(topSpeed * 3.6),          // km/h
      flightTime: Math.round(flightTime),            // s
      agility: +Math.min(2, agility).toFixed(2),
    },
    hint: twr < 3.5 ? 'TWR နိမ့် — cinematic သင့်' :
      twr > 7 ? 'TWR မြင့် — race/freestyle punch ကောင်း' :
      'Balanced build — အစုံသုံးလို့ကောင်း',
  };
}

// ---- one-tap drone presets ("drone ပြောင်း") ------------------------------
// Each preset is a complete parts loadout — tap to switch the whole drone,
// then fly. Colors are kept from the current build (pilot's paint job).
export const DRONE_PRESETS = {
  scout: {
    name: '🛰 Scout 3"', desc: 'သွက် · အတွင်းပိုင်း စူးစမ်း',
    build: { frame: 'f3', propeller: 'blade2', motor: 'kv1700', battery: 's4_1500' },
  },
  racer: {
    name: '🏁 Racer 5"', desc: 'Punch ↑↑ · top speed အမြင့်ဆုံး',
    build: { frame: 'f5', propeller: 'blade2', motor: 'kv2400', battery: 's6_1100' },
  },
  freestyle: {
    name: '🤸 Freestyle 5"', desc: 'Balanced — အစုံသုံး (default)',
    build: { frame: 'f5', propeller: 'blade3', motor: 'kv1900', battery: 's6_1100' },
  },
  cine: {
    name: '🎥 Cine', desc: 'Smooth ↑↑ · ရိုက်ကူးရေး တည်ငြိမ်',
    build: { frame: 'f5', propeller: 'blade7', motor: 'kv1700', battery: 's6_1800' },
  },
  longrange: {
    name: '📡 Long-range 7"', desc: 'အဝေးပျံ · flight time ↑↑',
    build: { frame: 'f7', propeller: 'blade3', motor: 'kv1700', battery: 's6_1800' },
  },
};
