import * as THREE from "three";

import type { VehicleKind } from "./maps/types";
import { resolveCollision, type Collider } from "./world";

/// ယာဉ်များ — ကား၊ လှေ၊ မြင်း၊ drone၊ နှင်းစီးစက်၊ ပူဖောင်း။
///
/// ★ **Physics engine မလိုဘူး** — arcade ပုံစံ ကိန်းဂဏန်းအနည်းငယ်နဲ့
///   လုံလောက်တယ်။ Cannon/Ammo ထည့်ရင် bundle က ၅၀၀KB တက်ပြီး ဖုန်းမှာ
///   frame ကျမယ်၊ ပြီးတော့ Roblox ရဲ့ ခံစားချက်က တကယ့် physics မဟုတ်ဘူး။
/// ★ **ရပ်နေရင် မလှည့်ရ** — `turnRate × min(1, |speed|/4)`။ ဒါမရှိရင်
///   ကားက နေရာမှာ လည်နေပြီး ကားလို မခံစားရဘူး။
/// ★ ယာဉ်ရဲ့ နေရာကို **driver ရဲ့ client က တွက်တယ်** (authority) — server က
///   relay + speed cap စစ်ရုံပဲ။ ဒါက latency အနည်းဆုံး ဖြစ်စေတယ်။

export type VehicleInput = {
  throttle: number;
  steer: number;
  lift: number;
  brake: boolean;
  boost: boolean;
};

export type VehicleSpec = {
  kind: VehicleKind;
  label: string;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  drag: number;
  seats: number;
  /// လေယာဉ်လား (drone/ပူဖောင်း) — အမြင့် လွတ်လပ်တယ်
  flying: boolean;
  /// ရေပေါ်မှသာ သွားလို့ရလား
  aquatic: boolean;
  ceiling: number;
  /// ကင်မရာ ဘယ်လောက် ဝေးရမလဲ
  camDist: number;
};

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  car: { kind: "car", label: "🚗 ကား", maxSpeed: 22, accel: 8, turnRate: 1.8, drag: 0.8, seats: 4, flying: false, aquatic: false, ceiling: 0, camDist: 11 },
  boat: { kind: "boat", label: "🛶 လှေ", maxSpeed: 12, accel: 3, turnRate: 1.1, drag: 0.9, seats: 4, flying: false, aquatic: true, ceiling: 0, camDist: 11 },
  horse: { kind: "horse", label: "🐴 မြင်း", maxSpeed: 16, accel: 6, turnRate: 2.4, drag: 1.4, seats: 2, flying: false, aquatic: false, ceiling: 0, camDist: 9 },
  drone: { kind: "drone", label: "🛸 Drone", maxSpeed: 18, accel: 7, turnRate: 2.2, drag: 1.1, seats: 2, flying: true, aquatic: false, ceiling: 60, camDist: 10 },
  snowmobile: { kind: "snowmobile", label: "🛷 နှင်းစီးစက်", maxSpeed: 20, accel: 9, turnRate: 2, drag: 1.2, seats: 2, flying: false, aquatic: false, ceiling: 0, camDist: 10 },
  balloon: { kind: "balloon", label: "🎈 ပူဖောင်း", maxSpeed: 6, accel: 1, turnRate: 0.6, drag: 0.6, seats: 4, flying: true, ceiling: 60, aquatic: false, camDist: 14 },
};

export type Vehicle = {
  id: string;
  kind: VehicleKind;
  spec: VehicleSpec;
  group: THREE.Group;
  state: { x: number; y: number; z: number; ry: number; speed: number };
  driver: string | null;
  /// Driver ပြတ်သွားပြီး ဘယ်လောက်ကြာပြီလဲ — ၅ စက္ကန့်ပြီးရင် လွတ်တယ်
  driverSeenAt: number;
  /// ကိုယ်တိုင် မောင်းနေရင် — physics တွက်တယ်
  drive(dt: number, input: VehicleInput, colliders: Collider[], walkRadius: number, inWater: (x: number, z: number) => boolean): void;
  /// တခြားသူ မောင်းနေရင် — server ကလာတဲ့ နေရာဆီ ချောချောရွှေ့တယ်
  follow(dt: number): void;
  setTarget(x: number, y: number, z: number, ry: number, speed: number): void;
  /// အသွင်အပြင် animation (ဘီးလှည့်၊ ပန်ကာလည်၊ မြင်းခြေ)
  animate(dt: number): void;
  dispose(): void;
};

function mat(color: number, emissive = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive,
  });
}

/// Roblox ပုံစံ — primitive အနည်းငယ်နဲ့ ဆောက်တယ်၊ GLB မလိုဘူး။
function buildModel(kind: VehicleKind): {
  group: THREE.Group;
  spin: THREE.Object3D[];
  legs: THREE.Object3D[];
  own: { dispose(): void }[];
} {
  const group = new THREE.Group();
  const spin: THREE.Object3D[] = [];
  const legs: THREE.Object3D[] = [];
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => {
    own.push(x);
    return x;
  };

  if (kind === "car" || kind === "snowmobile") {
    const bodyGeo = keep(new THREE.BoxGeometry(2, 0.7, 3.6));
    const bodyMat = keep(mat(kind === "car" ? 0xe94f37 : 0x2f6fb5));
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);

    const roofGeo = keep(new THREE.BoxGeometry(1.6, 0.6, 1.8));
    const roof = new THREE.Mesh(roofGeo, keep(mat(0x2a3038)));
    roof.position.set(0, 1.35, -0.2);
    group.add(roof);

    if (kind === "car") {
      const wheelGeo = keep(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10));
      const wheelMat = keep(mat(0x1a1d22));
      for (const [wx, wz] of [[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]] as const) {
        // ★ ဘီးကို hub group ထဲ ထည့်ပြီး **hub ကိုသာ** စောင်းတယ် (ဝင်ရိုးက
        //   ဘေးဘက် X ဆီ)。 လှည့်တာကတော့ ဘီး mesh ရဲ့ ကိုယ်ပိုင် Y —
        //   အဲဒါက cylinder ရဲ့ ဝင်ရိုးအတိုင်းမို့ ဘယ်လို တပ်တပ် မှန်နေတယ်။
        //   အရင်က mesh ကို တိုက်ရိုက် စောင်းပြီး Y ပတ် လှည့်ခဲ့တာ —
        //   Euler "XYZ" မှာ Y က မှတ်တိုင်စောင်းပြီးမှ လာလို့ ဝင်ရိုးပတ်
        //   လိမ့်တာ မဟုတ်ဘဲ ဘီးတစ်ခုလုံး ဘေးလှည့်သွားတယ်။
        const hub = new THREE.Group();
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, 0.42, wz);
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        hub.add(w);
        group.add(hub);
        spin.push(w);
      }
      const lampGeo = keep(new THREE.SphereGeometry(0.16, 8, 6));
      const lampMat = keep(mat(0xfff0c0, 0.9));
      for (const lx of [-0.6, 0.6]) {
        const l = new THREE.Mesh(lampGeo, lampMat);
        l.position.set(lx, 0.8, 1.85);
        group.add(l);
      }
    } else {
      const skiGeo = keep(new THREE.BoxGeometry(0.25, 0.12, 2.4));
      const skiMat = keep(mat(0xd8e4ec));
      for (const sx of [-0.7, 0.7]) {
        const s = new THREE.Mesh(skiGeo, skiMat);
        s.position.set(sx, 0.1, 0.6);
        group.add(s);
      }
    }
    return { group, spin, legs, own };
  }

  if (kind === "boat") {
    const hullGeo = keep(new THREE.BoxGeometry(1.8, 0.6, 4.4));
    const hull = new THREE.Mesh(hullGeo, keep(mat(0x9c6b3f)));
    hull.position.y = 0.4;
    hull.castShadow = true;
    group.add(hull);
    const rimGeo = keep(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 8));
    const rimMat = keep(mat(0x7a5230));
    for (const rx of [-0.9, 0.9]) {
      const r = new THREE.Mesh(rimGeo, rimMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(rx, 0.7, 0);
      group.add(r);
    }
    const seatGeo = keep(new THREE.BoxGeometry(1.4, 0.15, 0.5));
    for (const sz of [-0.8, 0.8]) {
      const s = new THREE.Mesh(seatGeo, rimMat);
      s.position.set(0, 0.75, sz);
      group.add(s);
    }
    return { group, spin, legs, own };
  }

  if (kind === "horse") {
    const bodyGeo = keep(new THREE.BoxGeometry(0.9, 0.9, 2));
    const brown = keep(mat(0x7a4a2a));
    const body = new THREE.Mesh(bodyGeo, brown);
    body.position.y = 1.25;
    body.castShadow = true;
    group.add(body);

    const neck = new THREE.Mesh(keep(new THREE.BoxGeometry(0.45, 1, 0.5)), brown);
    neck.position.set(0, 1.8, 0.85);
    neck.rotation.x = -0.4;
    group.add(neck);
    const head = new THREE.Mesh(keep(new THREE.BoxGeometry(0.42, 0.42, 0.9)), brown);
    head.position.set(0, 2.25, 1.25);
    group.add(head);

    const legGeo = keep(new THREE.BoxGeometry(0.22, 1.1, 0.22));
    const dark = keep(mat(0x4a2c18));
    for (const [lx, lz] of [[-0.32, 0.7], [0.32, 0.7], [-0.32, -0.7], [0.32, -0.7]] as const) {
      // ★ pivot ကို ခါးမှာထားပြီး mesh ကို အောက်ဆွဲတယ် — မဟုတ်ရင်
      // ခြေထောက်က အလယ်ကနေ လှည့်ပြီး မြေထဲ နစ်သွားမယ်
      const pivot = new THREE.Group();
      pivot.position.set(lx, 1.1, lz);
      const leg = new THREE.Mesh(legGeo, dark);
      leg.position.y = -0.55;
      pivot.add(leg);
      group.add(pivot);
      legs.push(pivot);
    }
    const tail = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 0.7, 0.16)), dark);
    tail.position.set(0, 1.5, -1.05);
    tail.rotation.x = 0.5;
    group.add(tail);
    return { group, spin, legs, own };
  }

  if (kind === "drone") {
    const bodyGeo = keep(new THREE.BoxGeometry(1.2, 0.3, 1.2));
    const body = new THREE.Mesh(bodyGeo, keep(mat(0x30363f)));
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);

    const armGeo = keep(new THREE.BoxGeometry(0.14, 0.1, 1.5));
    const armMat = keep(mat(0x22272e));
    const rotorGeo = keep(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 10));
    const rotorMat = keep(mat(0x8fd8ff, 0.4));
    const ledGeo = keep(new THREE.SphereGeometry(0.1, 6, 5));
    const ledMat = keep(mat(0x5effc0, 0.9));
    for (const [ax, az] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]] as const) {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(ax / 2, 1, az / 2);
      arm.rotation.y = Math.atan2(ax, az);
      group.add(arm);
      const rotor = new THREE.Mesh(rotorGeo, rotorMat);
      rotor.position.set(ax, 1.16, az);
      group.add(rotor);
      spin.push(rotor);
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(ax, 0.86, az);
      group.add(led);
    }
    return { group, spin, legs, own };
  }

  // balloon
  const envGeo = keep(new THREE.SphereGeometry(2.2, 14, 12));
  const env = new THREE.Mesh(envGeo, keep(mat(0xff6b9a)));
  env.position.y = 5.4;
  env.castShadow = true;
  group.add(env);
  const basketGeo = keep(new THREE.BoxGeometry(1.6, 1.1, 1.6));
  const basket = new THREE.Mesh(basketGeo, keep(mat(0x9c6b3f)));
  basket.position.y = 1.2;
  group.add(basket);
  const ropeGeo = keep(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 4));
  const ropeMat = keep(mat(0x6b5a3f));
  for (const [rx, rz] of [[-0.7, 0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]] as const) {
    const r = new THREE.Mesh(ropeGeo, ropeMat);
    r.position.set(rx, 2.9, rz);
    group.add(r);
  }
  return { group, spin, legs, own };
}

export function createVehicle(
  id: string,
  kind: VehicleKind,
  x: number,
  z: number,
  ry: number,
): Vehicle {
  const spec = VEHICLE_SPECS[kind];
  const model = buildModel(kind);
  const group = model.group;
  group.position.set(x, spec.flying ? 0.6 : 0, z);
  group.rotation.y = ry;

  const state = { x, y: spec.flying ? 0.6 : 0, z, ry, speed: 0 };
  const target = { x, y: state.y, z, ry, speed: 0 };
  let animT = 0;

  return {
    id,
    kind,
    spec,
    group,
    state,
    driver: null,
    driverSeenAt: 0,

    drive(dt, input, colliders, walkRadius, inWater) {
      // ── အရှိန် ─────────────────────────────────────────────────────────
      const boost = input.boost ? 1.35 : 1;
      state.speed += input.throttle * spec.accel * dt;
      state.speed *= 1 - spec.drag * dt;
      if (input.brake) state.speed *= 1 - 4 * dt;
      const cap = spec.maxSpeed * boost;
      state.speed = THREE.MathUtils.clamp(state.speed, -cap * 0.4, cap);

      // ★ ရပ်နေရင် မလှည့်ရ
      // ★ အနုတ်လက္ခဏာက မဖြစ်မနေ လိုတယ် — ယာဉ်ရဲ့ ရှေ့က +Z၊ အပေါ်က +Y ဆိုတော့
      //   မောင်းသူရဲ့ **ညာဘက်က −X** ဖြစ်တယ် (right = forward × up = ẑ × ŷ = −x̂)。
      //   Heading က (sin ry, 0, cos ry) မို့ ry တိုးတာက +X = ဘယ်ဘက် ဆီ လှည့်တယ်။
      //   အရင်က ပေါင်းထားလို့ D နှိပ်ရင် ဘယ်ကွေ့၊ A နှိပ်ရင် ညာကွေ့ ဖြစ်နေတယ်။
      state.ry -= input.steer * spec.turnRate * dt * Math.min(1, Math.abs(state.speed) / 4);

      const nx = state.x + Math.sin(state.ry) * state.speed * dt;
      const nz = state.z + Math.cos(state.ry) * state.speed * dt;

      if (spec.flying) {
        state.x = nx;
        state.z = nz;
        state.y = THREE.MathUtils.clamp(state.y + input.lift * 9 * dt, 0.6, spec.ceiling);
        // စက်ဝိုင်းအပြင် မထွက်ရ
        const r = Math.hypot(state.x, state.z);
        if (r > walkRadius * 2) {
          state.x = (state.x / r) * walkRadius * 2;
          state.z = (state.z / r) * walkRadius * 2;
        }
      } else if (spec.aquatic) {
        // ★ လှေက ကုန်းပေါ် မတက်ရ — တက်ရင် ချက်ချင်း နှေးသွားတယ်
        if (!inWater(nx, nz)) {
          state.speed *= 0.85;
        } else {
          state.x = nx;
          state.z = nz;
        }
      } else {
        // ★ ကားက ရေထဲ မဝင်ရ
        if (inWater(nx, nz)) {
          state.speed *= 0.5;
        } else {
          const solved = resolveCollision(nx, nz, state.x, state.z, colliders, walkRadius);
          // တိုက်မိရင် အရှိန်ကျတယ် — ဖြတ်မသွားဘူး
          if (Math.abs(solved.x - nx) > 0.001 || Math.abs(solved.z - nz) > 0.001) {
            state.speed *= 0.3;
          }
          state.x = solved.x;
          state.z = solved.z;
        }
      }

      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.ry;
      // ရှေ့ငိုက်/ဘေးစောင်း — မောင်းနေတဲ့ ခံစားချက်
      group.rotation.x = spec.flying ? -state.speed * 0.02 : 0;
      group.rotation.z = -input.steer * (spec.flying ? 0.15 : 0.05);
    },

    setTarget(tx, ty, tz, tr, ts) {
      target.x = tx;
      target.y = ty;
      target.z = tz;
      target.ry = tr;
      target.speed = ts;
    },

    follow(dt) {
      const k = Math.min(1, 10 * dt);
      state.x += (target.x - state.x) * k;
      state.y += (target.y - state.y) * k;
      state.z += (target.z - state.z) * k;
      let d = target.ry - state.ry;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      state.ry += d * k;
      state.speed = target.speed;
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.ry;
    },

    animate(dt) {
      animT += dt;
      const v = Math.abs(state.speed);
      for (const s of model.spin) {
        // ★ Drone ရဲ့ ပန်ကာက ရပ်နေတောင် လည်ရမယ် (hover) — ကားဘီးက မလည်ရ။
        // ★ ကားဘီးမှာ **အမှတ်အသား ပါတဲ့ speed** သုံးတယ် — နောက်ပြန်ဆုတ်ရင်
        //   ဘီးက ရှေ့ဆက်လိမ့်နေတာ မဖြစ်စေဖို့။ ဘီးအချင်းဝက် 0.42m မို့
        //   လိမ့်နှုန်း = speed / 0.42 (မလိမ့်ဘဲ ပွတ်ဆွဲသွားတာ မဖြစ်စေဘူး)。
        //   အနုတ်လက္ခဏာက ရှေ့တိုးရင် ဘီးအပေါ်ပိုင်း ရှေ့ကို လိမ့်စေတယ်။
        s.rotation.y += kind === "drone" ? 30 * dt : (-state.speed / 0.42) * dt;
      }
      for (let i = 0; i < model.legs.length; i++) {
        const leg = model.legs[i];
        if (!leg) continue;
        const phase = i < 2 ? 0 : Math.PI;
        leg.rotation.x = Math.sin(animT * Math.max(2, v * 1.4) + phase) * Math.min(0.7, v * 0.08);
      }
      if (spec.flying && v < 0.5) {
        // ငြိမ်နေရင် အနည်းငယ် ယိမ်း — မငြိမ်တာက ပျံနေတဲ့ ခံစားချက်
        group.position.y = state.y + Math.sin(animT * 2) * 0.08;
      }
    },

    dispose() {
      for (const d of model.own) d.dispose();
    },
  };
}
