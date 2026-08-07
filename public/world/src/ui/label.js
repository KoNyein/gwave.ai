// ============================================================
// label.js — ခေါင်းပေါ်နာမည် Sprite ထုတ်ပေးသည့် utility
// NPC နှင့် Remote ကစားသမား နှစ်မျိုးလုံး ဒီကိုသုံးနိုင်သည်
// ============================================================
import * as THREE from 'three';

export function makeNameLabel(text, color = '#f5c542') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '52px Padauk, "Myanmar Text", sans-serif';
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
