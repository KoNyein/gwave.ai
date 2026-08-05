// race/RaceSystem.js — gate pass detection + lap timing + ghost replay (tasks 2.1, 2.5)
import * as THREE from 'three';

export class RaceSystem {
  constructor(track) {
    this.track = track;
    this.state = 'IDLE';            // IDLE | RACING | FINISHED
    this.nextGate = 0;
    this.lap = 0;
    this.raceTime = 0;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = null;            // {time, frames}
    try {
      this.bestLap = JSON.parse(localStorage.getItem('gwdrone:best:' + track.id) || 'null');
    } catch { /* corrupt entry — start fresh */ }
    this.prevPos = new THREE.Vector3();
    // precompute gate local frames
    this._gates = track.gates.map(g => ({
      pos: new THREE.Vector3(...g.pos),
      cos: Math.cos(g.yaw), sin: Math.sin(g.yaw),
      halfW: g.width / 2, h: g.height,
    }));
    // ghost recording
    this._recFrames = [];
    this._recT = 0;
    this.REC_HZ = 20;
    // ghost playback
    this.ghostFrames = null;
    this.ghostT = 0;
    this.onEvent = () => {};        // 'start' | 'gate' | 'lap' | 'finish' | 'best'
  }

  start(dronePos) {
    this.state = 'RACING';
    this.nextGate = 0; this.lap = 0;
    this.raceTime = 0; this.lapStart = 0;
    this.lapTimes = [];
    this.prevPos.copy(dronePos);
    this._recFrames = []; this._recT = 0;
    this.ghostFrames = this.bestLap?.frames ?? null;
    this.ghostT = 0;
    this.onEvent('start');
  }
  stop() { this.state = 'IDLE'; }

  // world pos → gate local (x across, z through)
  _toLocal(g, p, out) {
    const dx = p.x - g.pos.x, dz = p.z - g.pos.z;
    out.x = dx * g.cos - dz * g.sin;
    out.z = dx * g.sin + dz * g.cos;
    out.y = p.y - g.pos.y;
    return out;
  }

  update(dt, dronePos, droneQuat) {
    if (this.state !== 'RACING') return;
    this.raceTime += dt;

    // ---- ghost record (best-lap candidate) ----
    this._recT += dt;
    if (this._recT >= 1 / this.REC_HZ) {
      this._recT = 0;
      this._recFrames.push([dronePos.x, dronePos.y, dronePos.z,
        droneQuat.x, droneQuat.y, droneQuat.z, droneQuat.w]);
    }

    // ---- gate crossing: prev→cur segment ဟာ gate plane ကိုဖြတ်လား ----
    const g = this._gates[this.nextGate];
    const a = this._toLocal(g, this.prevPos, this._la ??= new THREE.Vector3());
    const b = this._toLocal(g, dronePos, this._lb ??= new THREE.Vector3());
    if (a.z < 0 && b.z >= 0) {                       // plane ဖြတ် (direction မှန်)
      const t = -a.z / (b.z - a.z);                  // crossing point interpolate
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      if (Math.abs(cx) < g.halfW && cy > 0 && cy < g.h) {
        this.nextGate++;
        this.onEvent('gate', this.nextGate);
        if (this.nextGate >= this._gates.length) {   // lap ပြီး
          this.nextGate = 0;
          this.lap++;
          const lapTime = this.raceTime - this.lapStart;
          this.lapStart = this.raceTime;
          this.lapTimes.push(lapTime);
          // best lap + ghost save
          if (!this.bestLap || lapTime < this.bestLap.time) {
            this.bestLap = { time: lapTime, frames: this._recFrames };
            try {
              localStorage.setItem('gwdrone:best:' + this.track.id, JSON.stringify(this.bestLap));
            } catch { /* ghost frames too big for storage — keep in memory */ }
            this.onEvent('best', lapTime);
          }
          this._recFrames = [];
          this.onEvent('lap', lapTime);
          if (this.lap >= this.track.laps) {
            this.state = 'FINISHED';
            this.onEvent('finish', this.raceTime);
          }
        }
      }
    }
    this.prevPos.copy(dronePos);
  }

  // ghost playback pose (null = no ghost)
  ghostPose(dt, outPos, outQuat) {
    if (!this.ghostFrames?.length || this.state !== 'RACING') return false;
    this.ghostT += dt;
    const idx = this.ghostT * this.REC_HZ;
    const i0 = Math.floor(idx), i1 = Math.min(i0 + 1, this.ghostFrames.length - 1);
    if (i0 >= this.ghostFrames.length) { this.ghostT = 0; return false; } // loop
    const f0 = this.ghostFrames[i0], f1 = this.ghostFrames[i1], t = idx - i0;
    outPos.set(
      f0[0] + (f1[0] - f0[0]) * t,
      f0[1] + (f1[1] - f0[1]) * t,
      f0[2] + (f1[2] - f0[2]) * t);
    this._q1 ??= new THREE.Quaternion();
    this._q1.set(f1[3], f1[4], f1[5], f1[6]);
    outQuat.set(f0[3], f0[4], f0[5], f0[6]).slerp(this._q1, t);
    return true;
  }

  static fmt(t) {
    if (t == null) return '--:--:---';
    const m = (t / 60) | 0, s = t % 60;
    return String(m).padStart(2, '0') + ':' +
      String(s | 0).padStart(2, '0') + ':' +
      String(Math.round((s % 1) * 1000)).padStart(3, '0');
  }
}
