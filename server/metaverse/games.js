"use strict";

/// Mini-games (Phase 16)。
///
/// ★ **Game logic က server မှာ run ရမယ်**။ Client မှာ score တွက်ရင်
///   `{type:'gameAction', score: 999999}` ပို့ရုံနဲ့ leaderboard ထိပ်ဆုံး
///   ရောက်သွားမယ် — leaderboard ဆိုတာ အဲဒီအခါ အဓိပ္ပာယ်မရှိတော့ဘူး။
/// ★ **Game ကျရင် metaverse မကျရ** — game state က room state နဲ့ သီးခြား။
///   Game ထဲမှာ error တက်ရင် အဲဒီ game ကိုပဲ ရပ်ပြီး လောကက ဆက်လည်တယ်။
/// ★ **ဆုက cosmetic သာ** — ငွေဆုပေးရင် "ကစားပြီးငွေရ" ဖြစ်ပြီး ဥပဒေအရ
///   လောင်းကစားနဲ့ နီးလာတယ်။ ဝင်ကြေးလည်း မယူဘူး (spec 16.4)。

const TICK_MS = 500; // gameState ကို 2Hz ပို့တယ်

/// ── Game တစ်ခုချင်း ────────────────────────────────────────────────────────
/// အားလုံးက interface တူညီတယ် — အသစ်ထည့်ဖို့ ဒီ object တစ်ခု ရေးပြီး
/// `GAMES` ထဲ ထည့်ရုံပဲ (spec 16.1: game တစ်ခုချင်း hardcode မလုပ်ရ)。

const RACE = {
  id: "race",
  name: "Race",
  nameMy: "🏁 အပြေးပြိုင်ပွဲ",
  minPlayers: 1,
  maxPlayers: 12,
  durationSec: 120,
  arena: { x: 0, z: 0, radius: 60 },

  onStart(ctx) {
    // ★ Checkpoint နေရာတွေက server မှာသာ ရှိတယ်၊ client က `objectives`
    // ကနေ မြင်ရတယ် — ဒါပေမယ့် ဖြတ်ပြီလား ဆိုတာ server က ဆုံးဖြတ်တယ်။
    ctx.state.checkpoints = [
      { x: 20, z: -10 },
      { x: 30, z: 25 },
      { x: -5, z: 40 },
      { x: -30, z: 10 },
      { x: 0, z: 12 },
    ];
    for (const p of ctx.players.values()) p.next = 0;
  },

  onTick(ctx) {
    for (const p of ctx.players.values()) {
      const cp = ctx.state.checkpoints[p.next];
      if (!cp) continue;
      const pos = ctx.positionOf(p.id);
      if (!pos) continue;
      if (Math.hypot(pos.x - cp.x, pos.z - cp.z) < 4) {
        // ★ အစဉ်လိုက်သာ — checkpoint ၅ ကို အရင်ထိလို့ မရဘူး
        p.next++;
        p.score = p.next * 100;
        if (p.next >= ctx.state.checkpoints.length) {
          // အရင်ဆုံးရောက်သူက အမှတ်ပိုရတယ်
          p.score += Math.max(0, ctx.timeLeft());
          p.done = true;
        }
      }
    }
    if ([...ctx.players.values()].every((p) => p.done)) ctx.finish();
  },

  objectives(ctx, player) {
    const cp = ctx.state.checkpoints[player.next];
    return cp ? [{ kind: "checkpoint", x: cp.x, z: cp.z, index: player.next }] : [];
  },
};

const HUNT = {
  id: "hunt",
  name: "Treasure hunt",
  nameMy: "🔍 ရှာဖွေပွဲ",
  minPlayers: 1,
  maxPlayers: 20,
  durationSec: 180,
  arena: { x: 0, z: 0, radius: 70 },

  onStart(ctx) {
    // ★ ပစ္စည်းနေရာက server မှာသာ — client ကို ပို့လိုက်ရင် devtools ဖွင့်ပြီး
    // အကုန် တစ်ခါတည်း ကြည့်လို့ရမယ်။ client က "အနီးဆုံး" ကိုပဲ မြင်ရတယ်။
    ctx.state.items = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random();
      const r = 15 + Math.random() * 45;
      ctx.state.items.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, taken: null });
    }
  },

  onTick(ctx) {
    for (const p of ctx.players.values()) {
      const pos = ctx.positionOf(p.id);
      if (!pos) continue;
      for (const item of ctx.state.items) {
        if (item.taken) continue;
        if (Math.hypot(pos.x - item.x, pos.z - item.z) < 3) {
          item.taken = p.id;
          p.score += 100;
        }
      }
    }
    if (ctx.state.items.every((i) => i.taken)) ctx.finish();
  },

  objectives(ctx, player) {
    const pos = ctx.positionOf(player.id);
    if (!pos) return [];
    const open = ctx.state.items.filter((i) => !i.taken);
    if (open.length === 0) return [];
    // အနီးဆုံး ၂ ခုကိုသာ ပြတယ်
    return open
      .map((i) => ({ i, d: Math.hypot(pos.x - i.x, pos.z - i.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((e) => ({ kind: "item", x: e.i.x, z: e.i.z }));
  },
};

const TARGETS = {
  id: "targets",
  name: "Target practice",
  nameMy: "🎯 ပစ်မှတ်ပစ်",
  minPlayers: 1,
  maxPlayers: 10,
  durationSec: 90,
  arena: { x: 0, z: -20, radius: 25 },

  onStart(ctx) {
    ctx.state.targets = [];
    for (let i = 0; i < 5; i++) {
      ctx.state.targets.push({
        id: i,
        x: -18 + i * 9,
        z: -34,
        phase: Math.random() * Math.PI * 2,
        alive: true,
      });
    }
    ctx.state.elapsed = 0;
  },

  onTick(ctx, dt) {
    ctx.state.elapsed += dt;
    for (const t of ctx.state.targets) {
      // ရွေ့လျားပစ်မှတ် — server က နေရာကို တွက်တယ်
      t.x = t.x0 ?? (t.x0 = t.x);
      t.z = -34 + Math.sin(ctx.state.elapsed * 1.2 + t.phase) * 6;
    }
  },

  onPlayerAction(ctx, playerId, action) {
    // ★ ပစ်ချက်ကို **server က တွက်တယ်** — client က "ထိတယ်" ပြောတာ မယုံဘူး။
    // Client က ပစ်တဲ့နေရာနဲ့ ဦးတည်ရာပဲ ပို့တယ်။
    if (action?.type !== "shoot") return;
    const p = ctx.players.get(playerId);
    const pos = ctx.positionOf(playerId);
    if (!p || !pos) return;

    const now = Date.now();
    // ★ Rate limit — တစ်စက္ကန့် ၄ ချက်ထက် မပို (macro ကာကွယ်)
    if (now - (p.lastShot ?? 0) < 250) return;
    p.lastShot = now;

    const ry = Number(action.ry);
    if (!Number.isFinite(ry)) return;
    const dx = Math.sin(ry);
    const dz = Math.cos(ry);

    for (const t of ctx.state.targets) {
      if (!t.alive) continue;
      const vx = t.x - pos.x;
      const vz = t.z - pos.z;
      const dist = Math.hypot(vx, vz);
      if (dist > 40) continue;
      // ဦးတည်ရာနဲ့ ကိုက်လား (dot product)
      const aim = (vx / dist) * dx + (vz / dist) * dz;
      if (aim > 0.985) {
        t.alive = false;
        p.score += 100;
        setTimeout(() => {
          t.alive = true;
        }, 2500).unref?.();
        break;
      }
    }
  },

  objectives(ctx) {
    return ctx.state.targets
      .filter((t) => t.alive)
      .map((t) => ({ kind: "target", x: t.x, z: t.z }));
  },
};

const GROW = {
  id: "grow",
  name: "Grow-off",
  nameMy: "🌱 စိုက်ပျိုးပြိုင်ပွဲ",
  minPlayers: 1,
  maxPlayers: 12,
  durationSec: 150,
  arena: { x: -22, z: -14, radius: 20 },

  onStart(ctx) {
    for (const p of ctx.players.values()) {
      p.plants = [];
    }
  },

  onPlayerAction(ctx, playerId, action) {
    const p = ctx.players.get(playerId);
    const pos = ctx.positionOf(playerId);
    if (!p || !pos) return;
    const now = Date.now();

    if (action?.type === "plant") {
      // ★ အပင် ၆ ပင်ထက် မပို၊ ၂ စက္ကန့် တစ်ပင် — spam ကာကွယ်
      if (p.plants.length >= 6 || now - (p.lastPlant ?? 0) < 2000) return;
      p.lastPlant = now;
      p.plants.push({ x: pos.x, z: pos.z, water: 0, grown: 0, lastWater: 0 });
      return;
    }

    if (action?.type === "water") {
      for (const plant of p.plants) {
        if (Math.hypot(pos.x - plant.x, pos.z - plant.z) > 3) continue;
        // ★ ရေလောင်းတာကို ၃ စက္ကန့်တစ်ခါသာ — မဟုတ်ရင် ခလုတ်နှိပ်တာ
        // မြန်သူက အနိုင်ရမယ်၊ စိုက်ပျိုးမှုနဲ့ ဘာမှမဆိုင်တော့ဘူး။
        if (now - plant.lastWater < 3000) continue;
        plant.lastWater = now;
        plant.water = Math.min(5, plant.water + 1);
      }
    }
  },

  onTick(ctx, dt) {
    for (const p of ctx.players.values()) {
      let score = 0;
      for (const plant of p.plants) {
        plant.grown = Math.min(1, plant.grown + dt * 0.02 * (0.3 + plant.water * 0.18));
        score += Math.round(plant.grown * 100);
      }
      p.score = score;
    }
  },

  objectives(ctx, player) {
    return (player.plants ?? []).map((pl) => ({
      kind: "plant",
      x: pl.x,
      z: pl.z,
      grown: Math.round(pl.grown * 100) / 100,
    }));
  },
};

const GAMES = new Map([
  [RACE.id, RACE],
  [HUNT.id, HUNT],
  [TARGETS.id, TARGETS],
  [GROW.id, GROW],
]);

/// လူစုချိန် — ဒီအချိန်အတွင်း `gameJoin` ပို့သူတွေနဲ့ စတယ်။
/// ★ Test မှာ ၁၅ စက္ကန့် စောင့်နေရင် suite တစ်ခုလုံး နှေးသွားမယ် —
/// env နဲ့ တိုချုံ့လို့ရအောင် ထားတယ် (secret မဟုတ်ဘူး၊ ချိန်ညှိချက်သာ)。
const LOBBY_MS = Math.max(500, Number(process.env.MV_LOBBY_MS) || 15_000);

/// ── Runner ────────────────────────────────────────────────────────────────
/// `positionOf(roomId, playerId)` က player ရဲ့ လက်ရှိနေရာ (မရှိရင် null)。
/// `nameOf(roomId, playerId)` က leaderboard မှာ ပြဖို့ နာမည်။
function createGameRunner({ broadcast, sendTo, positionOf, nameOf, saveScores }) {
  /// roomId -> instance   (room တစ်ခုမှာ game တစ်ခုတည်း)
  const active = new Map();
  /// roomId -> lobby      (စောင့်နေဆဲ)
  const lobbies = new Map();
  let nextId = 1;

  function start(roomId, gameId, playerIds) {
    const game = GAMES.get(gameId);
    if (!game) return null;
    if (active.has(roomId)) return null; // room တစ်ခုမှာ game တစ်ခုတည်း

    const players = new Map();
    for (const id of playerIds) {
      players.set(id, {
        id,
        name: nameOf?.(roomId, id) ?? "Gwave",
        score: 0,
        next: 0,
        done: false,
      });
    }
    if (players.size < game.minPlayers) return null;

    const instance = {
      instanceId: `g${nextId++}`,
      roomId,
      game,
      players,
      state: {},
      endsAt: Date.now() + game.durationSec * 1000,
      timer: null,
      finished: false,
    };

    const ctx = {
      players,
      state: instance.state,
      // ★ roomId ကို ချည်ထားတယ် — game က ကိုယ့် room ထဲကလူကိုပဲ ကြည့်ရမယ်၊
      // တခြား room က id တစ်ခုနဲ့ တိုက်ဆိုင်သွားလို့ မဖြစ်ရ။
      positionOf: (id) => positionOf(roomId, id),
      timeLeft: () => Math.max(0, Math.round((instance.endsAt - Date.now()) / 1000)),
      finish: () => finish(instance),
    };
    instance.ctx = ctx;

    try {
      game.onStart(ctx);
    } catch (err) {
      console.error("[mv/games] onStart:", err.message);
      return null;
    }

    active.set(roomId, instance);
    broadcast(roomId, {
      type: "gameStart",
      instanceId: instance.instanceId,
      gameId,
      nameMy: game.nameMy,
      arena: game.arena,
      players: [...players.keys()],
      durationSec: game.durationSec,
    });

    let last = Date.now();
    instance.timer = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      try {
        game.onTick?.(ctx, dt);
      } catch (err) {
        // ★ Game ကျရင် အဲဒီ game ကိုပဲ ရပ်တယ် — လောကက ဆက်လည်တယ်
        console.error("[mv/games] onTick:", err.message);
        finish(instance);
        return;
      }
      if (instance.finished) return;
      if (now >= instance.endsAt) {
        finish(instance);
        return;
      }

      // ★ အမှတ်ပြားက room တစ်ခုလုံးဆီ — မကစားဘဲ **ဘေးကနေကြည့်လို့ရရမယ်**
      // (spec 16.6)。 ဒါပေမယ့် `objectives` ထဲမှာ ဝှက်ထားရမယ့် အချက်အလက်
      // (ရှာဖွေပွဲရဲ့ ပစ္စည်းနေရာ) ပါလို့ ကစားသူဆီပဲ သီးသန့်ပို့တယ်။
      broadcast(roomId, {
        type: "gameState",
        instanceId: instance.instanceId,
        timeLeft: ctx.timeLeft(),
        scores: [...players.values()].map((x) => ({
          id: x.id,
          name: x.name,
          score: x.score,
        })),
      });
      for (const p of players.values()) {
        sendTo(p.id, {
          type: "gameObjectives",
          instanceId: instance.instanceId,
          objectives: game.objectives?.(ctx, p) ?? [],
        });
      }
    }, TICK_MS);

    return instance;
  }

  function finish(instance) {
    if (instance.finished) return;
    instance.finished = true;
    clearInterval(instance.timer);
    active.delete(instance.roomId);

    const rankings = [...instance.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ playerId: p.id, name: p.name, score: p.score, rank: i + 1 }));

    broadcast(instance.roomId, {
      type: "gameEnd",
      instanceId: instance.instanceId,
      gameId: instance.game.id,
      rankings,
      // ★ ဆုက cosmetic သာ — ငွေ/crypto လုံးဝ မပါဘူး (spec 16.4)
      rewards: rankings
        .filter((r) => r.rank === 1)
        .map((r) => ({ playerId: r.playerId, sku: `badge_${instance.game.id}_win` })),
    });

    void saveScores?.(instance.game.id, rankings);
  }

  /// ── လူစုခြင်း ───────────────────────────────────────────────────────────
  /// ★ ပွဲက ချက်ချင်း မစဘူး — `gameInvite` ကို room တစ်ခုလုံးဆီ ကြေညာပြီး
  ///   ၁၅ စက္ကန့် စောင့်တယ်။ တစ်ယောက်တည်း နှိပ်တာနဲ့ စလိုက်ရင် ကျန်တဲ့သူတွေ
  ///   ဘယ်တော့မှ မမီဘူး။
  /// ★ ပွဲ run နေရင် lobby မဖွင့်ဘူး — ဝင်မကစားရပေမယ့် **ကြည့်လို့တော့ရတယ်**
  ///   (`gameState` က room တစ်ခုလုံးဆီ သွားတယ်)。
  function join(roomId, playerId, gameId) {
    if (active.has(roomId)) return "running";

    const lobby = lobbies.get(roomId);
    if (lobby) {
      // ရှိပြီးသား lobby ထဲ ဝင်တယ် — gameId မတူလည်း အဲဒီပွဲထဲပဲ ဝင်တယ်
      // (room တစ်ခုမှာ ပွဲတစ်ခုတည်း)。
      const game = GAMES.get(lobby.gameId);
      if (lobby.players.size >= game.maxPlayers) return "full";
      lobby.players.add(playerId);
      broadcast(roomId, {
        type: "gameInvite",
        gameId: lobby.gameId,
        nameMy: game.nameMy,
        arena: game.arena,
        startsIn: Math.max(0, Math.round((lobby.startsAt - Date.now()) / 1000)),
        joined: [...lobby.players],
      });
      return "joined";
    }

    const game = GAMES.get(gameId);
    if (!game) return "unknown";

    const fresh = {
      gameId,
      players: new Set([playerId]),
      startsAt: Date.now() + LOBBY_MS,
      timer: null,
    };
    lobbies.set(roomId, fresh);
    fresh.timer = setTimeout(() => {
      lobbies.delete(roomId);
      if (!start(roomId, gameId, [...fresh.players])) {
        broadcast(roomId, {
          type: "gameCancelled",
          gameId,
          reason: "လူမပြည့်လို့ ပွဲ ဖျက်လိုက်တယ်",
        });
      }
    }, LOBBY_MS);
    fresh.timer.unref?.();

    broadcast(roomId, {
      type: "gameInvite",
      gameId,
      nameMy: game.nameMy,
      arena: game.arena,
      startsIn: Math.round(LOBBY_MS / 1000),
      joined: [...fresh.players],
    });
    return "joined";
  }

  return {
    list: () =>
      [...GAMES.values()].map((g) => ({
        id: g.id,
        nameMy: g.nameMy,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        durationSec: g.durationSec,
        arena: g.arena,
      })),

    start,
    join,

    action(roomId, playerId, action) {
      const instance = active.get(roomId);
      if (!instance || !instance.players.has(playerId)) return;
      try {
        instance.game.onPlayerAction?.(instance.ctx, playerId, action);
      } catch (err) {
        console.error("[mv/games] onPlayerAction:", err.message);
      }
    },

    /// ★ ကစားသူ ပြတ်သွားရင် **game ဆက်သွားရမယ်** — ကျန်တဲ့သူတွေရဲ့
    /// ပွဲကို တစ်ယောက်ထွက်သွားလို့ ဖျက်လိုက်တာ မတရားဘူး။
    drop(roomId, playerId) {
      const lobby = lobbies.get(roomId);
      if (lobby) {
        lobby.players.delete(playerId);
        if (lobby.players.size === 0) {
          clearTimeout(lobby.timer);
          lobbies.delete(roomId);
        }
      }
      const instance = active.get(roomId);
      if (!instance) return;
      instance.players.delete(playerId);
      if (instance.players.size === 0) finish(instance);
    },

    activeIn: (roomId) => active.get(roomId) ?? null,
    lobbyIn: (roomId) => lobbies.get(roomId) ?? null,

    stopAll() {
      for (const instance of active.values()) clearInterval(instance.timer);
      active.clear();
      for (const lobby of lobbies.values()) clearTimeout(lobby.timer);
      lobbies.clear();
    },
  };
}

module.exports = { createGameRunner, GAMES };
