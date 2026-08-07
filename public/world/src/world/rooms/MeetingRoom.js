// ============================================================
// MeetingRoom.js — 🏛️ Meeting Space (Spaces)
// Meeting code တစ်ခုစီ room တစ်ခု (id = meet:<CODE>) — ရောက်နေသူချင်း
// အချင်းချင်းမြင်ရ + proximity voice ပြောနိုင် + emote ပြနိုင်
//
// Space themes ၃ မျိုး — lagoon / hall / rooftop
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';

export class MeetingRoom extends Room {
  constructor(ctx, { code, space, title, host }) {
    super(`meet:${code}`, `🏛️ ${title}`);
    this.ctx = ctx;
    this.code = code;
    this.space = space || 'hall';
    this.host = host;
    this.background = this.space === 'lagoon' ? 0x8fc6e8
                    : this.space === 'rooftop' ? 0x1a2440 : 0x0d1428;
  }

  build() {
    const isLagoon = this.space === 'lagoon';
    const isRoof = this.space === 'rooftop';

    // ကြမ်းပြင်
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 48),
      new THREE.MeshStandardMaterial({
        color: isLagoon ? 0xd9c9a3 : isRoof ? 0x2c3040 : 0x151d33,
        roughness: isLagoon ? 1 : 0.5, metalness: isLagoon ? 0 : 0.3,
      })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.group.add(floor);

    // အလင်း
    addRoomLighting(this, isLagoon ? 'day' : 'indoor');

    if (isLagoon) {
      // ရေပြင် + တောင်တန်း silhouette
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(90, 48),
        new THREE.MeshStandardMaterial({ color: 0x2d7fb8, roughness: 0.15, metalness: 0.6 })
      );
      water.rotation.x = -Math.PI / 2; water.position.y = -0.35;
      this.group.add(water);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(14 + Math.random() * 8, 16 + Math.random() * 14, 5),
          new THREE.MeshStandardMaterial({ color: 0x3f5a44, roughness: 1 })
        );
        hill.position.set(Math.cos(a) * 80, 6, Math.sin(a) * 80);
        this.group.add(hill);
      }
    } else {
      // ခန်းမ — ရွှေတိုင် ၈ လုံး + အမိုးကွင်း (Gwave theme)
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xc9932b, metalness: 0.85, roughness: 0.25,
        emissive: 0x3a2a00, emissiveIntensity: 0.4,
      });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 8, 10), pillarMat);
        pillar.position.set(Math.cos(a) * 17, 4, Math.sin(a) * 17);
        pillar.castShadow = true;
        this.group.add(pillar);
        this.addCollider(pillar);
      }
      const dome = new THREE.Mesh(
        new THREE.TorusGeometry(17, 0.3, 10, 60),
        new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.55 })
      );
      dome.rotation.x = Math.PI / 2; dome.position.y = 8;
      this.group.add(dome);
    }

    // ⭕ ဆွေးနွေးပွဲ ထိုင်ခုံစက်ဝိုင်း (၁၂ လုံး)
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x3a4560, roughness: 0.8 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 1.1), seatMat);
      seat.position.set(Math.cos(a) * 9, 0.22, Math.sin(a) * 9);
      seat.castShadow = true;
      this.group.add(seat);
      this.addCollider(seat);
    }

    // 🖥️ ဗဟို Presentation Screen — meeting info + speaker
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1024; this.screenCanvas.height = 512;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 5.5),
      new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true })
    );
    screen.position.set(0, 4.2, -13);
    this.group.add(screen);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x141b30, metalness: 0.7, roughness: 0.3 })
    );
    frame.position.set(0, 4.2, -13.2);
    this.group.add(frame);
    this.drawScreen([]);

    // Portal — မြို့ထဲပြန်
    this.addPortal({
      position: new THREE.Vector3(0, 0, 15),
      targetRoomId: 'yangon',
      label: 'အစည်းအဝေးမှ ထွက်ရန် (Cyber-Yangon)',
      color: 0xffb020,
    });
    this.spawn.set(0, 0, 12);
  }

  // Screen မှာ meeting code + ပါဝင်သူများ + စကားပြောနေသူ ပြ
  drawScreen(speakers) {
    const c = this.screenCanvas.getContext('2d');
    c.clearRect(0, 0, 1024, 512);
    c.fillStyle = 'rgba(6,9,19,.88)'; c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#f5c542'; c.font = 'bold 46px Padauk, sans-serif';
    c.fillText(this.title.replace('🏛️ ', ''), 34, 70);
    c.strokeStyle = '#f5c542'; c.globalAlpha = .5;
    c.beginPath(); c.moveTo(34, 92); c.lineTo(990, 92); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = '#8a97b8'; c.font = '30px Padauk, sans-serif';
    c.fillText(`🔗 Code: ${this.code}    👤 Host: ${this.host || '—'}`, 34, 148);
    c.fillStyle = '#3ddc97'; c.font = 'bold 34px Padauk, sans-serif';
    c.fillText(speakers.length ? `🎙️ ပြောနေသူ: ${speakers.join(', ')}` : '🎙️ တိတ်ဆိတ်နေသည်', 34, 216);
    c.fillStyle = '#eaf0ff'; c.font = '28px Padauk, sans-serif';
    c.fillText('[V] mic ဖွင့်/ပိတ်   ·   [G] emote   ·   အနီးကပ်လေ အသံကြားလေ', 34, 300);
    c.fillText('Code ကို မျှဝေပြီး သူငယ်ချင်းများကို ဖိတ်ကြားပါ', 34, 350);
    this.screenTex.needsUpdate = true;
  }

  update(dt, time) {
    super.update(dt, time);
    // စကားပြောနေသူများ screen ပေါ်တင် (၀.၅ စက္ကန့်တစ်ခါ)
    this._t = (this._t || 0) + dt;
    if (this._t > 0.5) {
      this._t = 0;
      const net = this.ctx.net;
      const speakers = [...(net?.remotes.values() || [])].filter(r => r.speaking).map(r => r.name);
      if (net?.localSpeaking) speakers.unshift('သင်');
      const key = speakers.join('|');
      if (key !== this._lastSpeakers) { this._lastSpeakers = key; this.drawScreen(speakers); }
    }
  }
}
