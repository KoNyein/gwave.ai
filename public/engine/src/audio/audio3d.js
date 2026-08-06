// audio/audio3d.js — Phase 2 spatial audio (spec §14)
// Procedural WebAudio SFX with true positional playback: each one-shot goes
// through a PannerNode (HRTF) whose listener follows the play camera. No
// asset downloads; the same clip names as the 2D api.

export function createAudio3d() {
  let ctx = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  };

  /** move the listener to the camera each frame (play mode) */
  function updateListener(pos, yaw) {
    if (!ctx) return;
    const l = ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = pos[0];
      l.positionY.value = pos[1];
      l.positionZ.value = pos[2];
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(pos[0], pos[1], pos[2]);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  function chain(pos) {
    const c = ensure();
    const gain = c.createGain();
    if (pos) {
      const pan = c.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 2;
      pan.maxDistance = 60;
      pan.positionX?.setValueAtTime(pos[0], c.currentTime);
      pan.positionY?.setValueAtTime(pos[1], c.currentTime);
      pan.positionZ?.setValueAtTime(pos[2], c.currentTime);
      if (!pan.positionX) pan.setPosition(pos[0], pos[1], pos[2]);
      gain.connect(pan);
      pan.connect(c.destination);
    } else {
      gain.connect(c.destination);
    }
    return { c, gain };
  }

  function beep(freq, dur, vol, type, pos) {
    try {
      const { c, gain } = chain(pos);
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(gain);
      o.start();
      o.stop(c.currentTime + dur);
    } catch {
      /* autoplay-blocked until first tap — fine */
    }
  }

  const clips = {
    coin: (pos) => {
      beep(880, 0.08, 0.5, "square", pos);
      setTimeout(() => beep(1320, 0.1, 0.5, "square", pos), 70);
    },
    hurt: (pos) => beep(160, 0.2, 0.7, "sawtooth", pos),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 0.4, "sine"), i * 130)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.22, 0.4, "sine"), i * 160)),
    click: (pos) => beep(600, 0.05, 0.3, "sine", pos),
    step: (pos) => beep(90 + Math.random() * 30, 0.05, 0.25, "triangle", pos),
  };

  return {
    play(name) {
      clips[name]?.(null);
    },
    playAt(name, pos) {
      clips[name]?.(pos);
    },
    updateListener,
  };
}
