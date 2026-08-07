// ============================================================
// Physics.js — ပေါ့ပါးသော Collision စနစ် (AABB / Box3 အခြေခံ)
// နံရံဖြတ်မထွက်နိုင်တော့ + အဆောက်အအုံ/သေတ္တာပေါ် တက်ရပ်နိုင်
// Room တစ်ခုစီက colliders (Box3 များ) ကို ပေးထားရုံဖြင့် အလုပ်လုပ်သည်
// ============================================================

export class PhysicsWorld {
  constructor() { this.colliders = []; }

  setColliders(list) { this.colliders = list; }

  // ခြေထောက်အောက်က ကြမ်းပြင်အမြင့် — box ပေါ်ရပ်နိုင်ရန်
  groundHeight(pos, radius) {
    let g = 0; // မူလမြေပြင် y=0
    for (const b of this.colliders) {
      if (pos.x > b.min.x - radius && pos.x < b.max.x + radius &&
          pos.z > b.min.z - radius && pos.z < b.max.z + radius) {
        // ခြေထောက်နှင့် 0.55m အတွင်းရှိသော box ထိပ် = တက်ရပ်လို့ရသော ကြမ်းပြင်
        if (b.max.y <= pos.y + 0.55 && b.max.y > g) g = b.max.y;
      }
    }
    return g;
  }

  // ရေပြင်ညီ တိုက်မိမှု — capsule (radius) ကို box များထဲမှ တွန်းထုတ်
  resolveHorizontal(pos, radius, height) {
    for (const b of this.colliders) {
      if (b.max.y <= pos.y + 0.55) continue;   // ခြေထောက်အောက် = ကြမ်းပြင်၊ နံရံမဟုတ်
      if (b.min.y >= pos.y + height) continue; // ခေါင်းပေါ်ကျော် = မထိ

      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;

      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // box အတွင်းရောက်နေလျှင် — အနီးဆုံးဘက်မှ တွန်းထုတ်
        const px = Math.min(pos.x - b.min.x, b.max.x - pos.x);
        const pz = Math.min(pos.z - b.min.z, b.max.z - pos.z);
        if (px < pz) pos.x = (pos.x - b.min.x < b.max.x - pos.x) ? b.min.x - radius : b.max.x + radius;
        else         pos.z = (pos.z - b.min.z < b.max.z - pos.z) ? b.min.z - radius : b.max.z + radius;
      }
    }
  }

  // မျဉ်းကြောင်းတစ်လျှောက် နံရံရှိမရှိ — ပစ်ခတ်မှု / LoS (Line of Sight) အတွက်
  // origin/target = Vector3 ။ ပိတ်ဆို့လျှင် true
  blocked(ray, maxDist, _tmp) {
    for (const b of this.colliders) {
      const hit = ray.intersectBox(b, _tmp);
      if (hit && hit.distanceTo(ray.origin) < maxDist) return true;
    }
    return false;
  }
}
