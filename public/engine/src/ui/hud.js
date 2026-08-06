// ui/hud.js — data-driven game HUD + tiny WebAudio SFX (spec §13, §14)
// The engine emits events; the HUD only renders. No game logic here.

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const els = {
    score: $("h-score"),
    coins: $("h-coins"),
    coinmax: $("h-coinmax"),
    hp: $("h-hp"),
    time: $("h-time"),
    msg: $("h-msg"),
    banner: $("h-banner"),
  };
  let msgTimer = null;

  world.events.on("scoreChanged", ({ score }) => {
    if (els.score) els.score.textContent = String(score);
  });
  world.events.on("healthChanged", ({ hp, maxHp }) => {
    if (els.hp) els.hp.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
  });

  const api = {
    message(text, seconds = 2) {
      if (!els.msg) return;
      els.msg.textContent = text;
      els.msg.style.opacity = text ? 1 : 0;
      clearTimeout(msgTimer);
      if (text) msgTimer = setTimeout(() => (els.msg.style.opacity = 0), seconds * 1000);
    },
    banner(text, win) {
      if (!els.banner) return;
      els.banner.textContent = text;
      els.banner.className = `banner ${win ? "win" : "lose"}`;
      els.banner.style.opacity = 1;
    },
    setCoins(coins, total) {
      if (els.coins) els.coins.textContent = String(coins);
      if (els.coinmax) els.coinmax.textContent = String(total);
    },
    tick() {
      if (els.time) els.time.textContent = String(world.vars.time.toFixed(0));
      if (els.coins) els.coins.textContent = String(world.vars.coins ?? 0);
    },
    reset() {
      if (els.banner) {
        els.banner.style.opacity = 0;
        els.banner.className = "banner";
      }
      api.message("");
      if (els.score) els.score.textContent = "0";
      if (els.hp) els.hp.style.width = "100%";
    },
  };
  return api;
}

/// Tiny WebAudio SFX — coin/hurt/win beeps with zero asset downloads.
export function createAudio() {
  let ctx = null;
  const ensure = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());
  const beep = (freq, dur, gain = 0.14, type = "sine") => {
    try {
      const c = ensure();
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch {
      /* autoplay-blocked until first tap — fine */
    }
  };
  const clips = {
    coin: () => {
      beep(880, 0.08, 0.12, "square");
      setTimeout(() => beep(1320, 0.1, 0.12, "square"), 70);
    },
    hurt: () => beep(160, 0.2, 0.2, "sawtooth"),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 130)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.22), i * 160)),
    click: () => beep(600, 0.05, 0.08),
  };
  return {
    play(name) {
      clips[name]?.();
    },
  };
}
