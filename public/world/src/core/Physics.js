// ============================================================
// Physics.js — ပေါ့ပါးသော Collision စနစ် (AABB / Box3 အခြေခံ)
// နံရံဖြတ်မထွက်နိုင်တော့ + အဆောက်အအုံ/သေတ္တာပေါ် တက်ရပ်နိုင်
// Room တစ်ခုစီက colliders (Box3 များ) ကို ပေးထားရုံဖြင့် အလုပ်လုပ်သည်
// ============================================================

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
    /// 🏔️ မြေမျက်နှာသွင်ပြင် — `(x, z) → အမြင့်`。 Terrain.js က ထည့်တယ်။
    /// ပေးမထားရင် မြေပြင်က ပြားနေတယ်လို့ သဘောထားတယ် (အရင်အတိုင်း)。
    this.terrain = null;
  }

  setColliders(list) { this.colliders = list; }

  /// 🏔️ တောင်တန်း ပေါ် တက်လို့ရအောင် — အခန်း ကူးတိုင်း ပြန်ချိန်တယ်
  setTerrain(fn) { this.terrain = fn || null; }

  /// မြေမျက်နှာ အမြင့် (တောင်တန်း အပါ) — box မပါဘူး
  terrainHeight(x, z) { return this.terrain ? this.terrain(x, z) : 0; }

  // ခြေထောက်အောက်က ကြမ်းပြင်အမြင့် — box ပေါ်ရပ်နိုင်ရန်
  groundHeight(pos, radius) {
    // ★ မူလမြေပြင်က ၀ မဟုတ်တော့ဘူး — တောင်ကုန်းပေါ် ရောက်နေရင် အဲဒီ
    //   အမြင့်ကနေ စတယ်။ ကစားကွင်း အလယ်မှာ terrain က ၀ ဖြစ်အောင်
    //   mask ထားလို့ မြို့ထဲမှာ ဘာမှ မပြောင်းဘူး။
    let g = this.terrainHeight(pos.x, pos.z);
    for (const b of this.colliders) {
      if (pos.x > b.min.x - radius && pos.x < b.max.x + radius &&
          pos.z > b.min.z - radius && pos.z < b.max.z + radius) {
        // ခြေထောက်နှင့် 0.55m အတွင်းရှိသော box ထိပ် = တက်ရပ်လို့ရသော ကြမ်းပြင်
        if (b.max.y <= pos.y + 0.55 && b.max.y > g) g = b.max.y;
      }
    }
    return g;
  }

  /**
   * 🧗 **တောင်ကို ချောင်းတက်လို့ မရ** — မတ်စောက်လွန်းရင် တားတယ်။
   *
   * user: "တောင်တန်းများပေါ် တက်တတ်ရအောင်"
   *
   * တောင်ပေါ် တက်လို့ရဖို့ terrain ကို ကြမ်းပြင် အဖြစ် ယူရုံနဲ့ မလုံလောက်ဘူး —
   * အဲဒါဆို ဒေါင်လိုက် ကျောက်နံရံကိုတောင် လျှောက်တက်သွားနိုင်တယ်။ ဒါကြောင့်
   * ခြေလှမ်း တစ်လှမ်းမှာ **၀.၈ m ထက် ပိုတက်ရရင် တားလိုက်တယ်** — လမ်းစောင်း
   * တွေက တက်လို့ရပြီး နံရံတွေက မရဘူး (တကယ့် တောင်တက်တာလိုပဲ)。
   *
   * @param from — ရွှေ့မတိုင်ခင် တည်နေရာ (y = လက်ရှိ မြေအမြင့်)
   * @param pos  — ရွှေ့ပြီး တည်နေရာ (ပြင်ပေးမယ်)
   */
  resolveSlope(from, pos, maxRise = 0.8) {
    if (!this.terrain) return;
    const h = this.terrain(pos.x, pos.z);
    if (h - from.y <= maxRise) return;
    // မတ်လွန်းတယ် — မရွှေ့ခင် နေရာကို ပြန်ထား
    pos.x = from.x;
    pos.z = from.z;
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
