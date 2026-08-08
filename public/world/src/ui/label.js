// ============================================================
// label.js — ခေါင်းပေါ်နာမည် Sprite ထုတ်ပေးသည့် utility
// NPC နှင့် Remote ကစားသမား နှစ်မျိုးလုံး ဒီကိုသုံးနိုင်သည်
// ============================================================
import * as THREE from 'three';

export function makeNameLabel(text, color = '#f5c542') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  // ★ စာလုံး အရှည်ကြီးရင် **အလိုအလျောက် ချုံ့** — အရင်က ၅၂px အသေထားလို့
  //   နောက်ခံ ဘောက်စ်ကပဲ ၅၀၀ မှာ ရပ်ပြီး စာက အနား ကျော်ထွက်၊ ဂိတ်
  //   ဆိုင်းဘုတ်မှာ "…yber-Yangon သို့ပြန်ရန်" လို့ ဖြတ်နေတယ်။
  const FIT = 464;
  let size = 52;
  ctx.font = `${size}px Padauk, "Myanmar Text", sans-serif`;
  const raw = ctx.measureText(text).width;
  if (raw > FIT) {
    size = Math.max(24, Math.floor(size * FIT / raw));
    ctx.font = `${size}px Padauk, "Myanmar Text", sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(7,11,24,.75)';
  const w = Math.min(500, ctx.measureText(text).width + 48);
  ctx.beginPath(); ctx.roundRect(256 - w / 2, 20, w, 84, 18); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 82);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
  }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.35;
  return sprite;
}
