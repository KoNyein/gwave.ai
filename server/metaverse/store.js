"use strict";

const { Pool } = require("pg");

/// RDS persistence — ထွက်ပြီး ပြန်ဝင်ရင် နေရာဟောင်းမှာ ပြန်ရောက်ဖို့။
///
/// ★ စည်းမျဉ်း ၂ ခု:
///   1. **position update တိုင်း DB မရေးရ** — 15Hz × player ၁၀၀ = တစ်စက္ကန့်
///      write ၁၅၀၀။ db.t4g.micro က အဲဒါကို ခံနိုင်မှာမဟုတ်ဘူး၊ ပြီးတော့
///      သိမ်းစရာလည်း မလိုဘူး — အရေးကြီးတာက **နောက်ဆုံးနေရာ** ပဲ။
///      Memory ထဲမှာထားပြီး ၃၀ စက္ကန့်တစ်ခါ + ထွက်ချိန်မှာသာ flush လုပ်တယ်။
///   2. **DB မရှိလည်း လောကက အလုပ်လုပ်ရမယ်** — DATABASE_URL မထည့်ရင်
///      function တွေက တိတ်တိတ်ပဲ ဘာမှမလုပ်ဘူး။ DB ကျနေရင်လည်း အတူတူ:
///      error ကို log ထဲထည့်ပြီး ဆက်သွားတယ်၊ ဘယ်တော့မှ ပြတ်မသွားစေရ။

const RETENTION_DAYS = 30;

/// TLS ကို ဘယ်လိုသုံးမလဲ ဆုံးဖြတ်တယ်။
///
/// ★ URL ထဲ `sslmode=` ရေးထားရင် **ဒါကို လေးစားရမယ်** — `undefined` ပြန်ပေးရင်
///   `pg` က connection string ထဲက sslmode ကို ကိုယ်တိုင် ဖတ်တယ်။ ဒီနေရာမှာ
///   အတင်း override လုပ်ရင် operator က sslmode ကို ဘယ်လိုရေးရေး အလုပ်မလုပ်တော့ဘူး။
/// ★ Unix socket (`host=/...`) နဲ့ localhost မှာ TLS မရှိဘူး — အတင်း
///   ဖွင့်လိုက်ရင် "server does not support SSL connections" နဲ့ ကျမယ်။
/// ★ ကျန်တာ (= RDS) မှာ TLS ဖွင့်တယ်။ CA bundle မထည့်ထားရင် self-signed လို့
///   ငြင်းတတ်လို့ rejectUnauthorized ကို ပိတ်ထားတယ် — connection က VPC
///   အတွင်းမှာသာ ဖြစ်ပြီး internet ကို မဖြတ်ဘူး။
function chooseSsl(databaseUrl) {
  if (/[?&]sslmode=/.test(databaseUrl)) return undefined;
  if (/[?&]host=(%2[Ff]|\/)/.test(databaseUrl)) return false; // unix socket
  try {
    const host = new URL(databaseUrl).hostname;
    if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  } catch {
    return false; // URL အနေနဲ့ မဖတ်နိုင်ရင် TLS ကို အတင်းမဖွင့်ဘူး
  }
  return { rejectUnauthorized: false };
}

function createStore(databaseUrl) {
  if (!databaseUrl) {
    // DB မရှိတဲ့ mode — API တူတူပဲ၊ ဘာမှမလုပ်ဘူး။ ခေါ်တဲ့ဘက်မှာ
    // `if (store)` စစ်စရာမလိုတော့ဘူး။
    return {
      enabled: false,
      async loadPlayer() {
        return null;
      },
      async savePlayer() {},
      async logChat() {},
      async getPlotsAround() {
        return [];
      },
      async saveGameScores() {},
      async purgeOldChat() {
        return 0;
      },
      async close() {},
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: chooseSsl(databaseUrl),
  });

  // ★ Pool error ကို မဖမ်းရင် idle client တစ်ခု ပြတ်သွားတာနဲ့ process
  // တစ်ခုလုံး crash ဖြစ်တယ် (unhandled 'error' event)။
  pool.on("error", (err) => {
    console.error("[mv/store] pool error:", err.message);
  });

  const q = async (text, params, fallback = null) => {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.error("[mv/store] query failed:", err.message);
      return fallback;
    }
  };

  return {
    enabled: true,

    /// ဝင်လာချိန် နေရာဟောင်း ပြန်ယူ — မရှိရင် null (spawn မှာ စမယ်)။
    async loadPlayer(userId) {
      const res = await q(
        `select display_name, x, y, z, ry, room, avatar_color, wallet, total_minutes
           from public.mv_players where user_id = $1`,
        [userId],
      );
      return res?.rows?.[0] ?? null;
    },

    /// ထွက်ချိန် + ၃၀ စက္ကန့်တစ်ခါ။ `minutes` က ဒီ flush မှာ ပေါင်းထည့်မယ့်
    /// အချိန် (session စုစုပေါင်းမဟုတ်ဘူး — မဟုတ်ရင် ၂ ခါရေရင် ၂ ဆဖြစ်မယ်)။
    async savePlayer(userId, s) {
      await q(
        `insert into public.mv_players
           (user_id, display_name, x, y, z, ry, room, total_minutes, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (user_id) do update set
           display_name  = excluded.display_name,
           x = excluded.x, y = excluded.y, z = excluded.z, ry = excluded.ry,
           room = excluded.room,
           total_minutes = public.mv_players.total_minutes + excluded.total_minutes,
           updated_at = now()`,
        [
          userId,
          s.name ?? "Gwave",
          s.x ?? 0,
          s.y ?? 0,
          s.z ?? 0,
          s.ry ?? 0,
          s.room ?? "city",
          Math.max(0, Math.round(s.minutes ?? 0)),
        ],
      );
    },

    /// Moderation အတွက်။ ★ ဧည့်သည်တွေရဲ့ စာလည်း မှတ်ရမယ် — moderation
    /// လိုအပ်တာက အများအားဖြင့် ဧည့်သည်တွေဆီကပဲ။ ဒါကြောင့် user_id က text၊
    /// profiles ကို FK မချိတ်ဘူး။
    async logChat(userId, name, room, text) {
      await q(
        `insert into public.mv_chat_log (user_id, name, room, text)
         values ($1, $2, $3, $4)`,
        [String(userId), name ?? null, room, text],
      );
    },

    async getPlotsAround(gx, gz, radius) {
      const res = await q(
        `select plot_id, grid_x, grid_z, owner_wallet, owner_user, build_data
           from public.mv_plots
          where grid_x between $1 and $2 and grid_z between $3 and $4`,
        [gx - radius, gx + radius, gz - radius, gz + radius],
      );
      return res?.rows ?? [];
    },

    /// Mini-game ရဲ့ ရလဒ် (Phase 16.5)。
    ///
    /// ★ အမှတ်က **server ကနေသာ** လာတယ် — client က ပို့တဲ့ score ကို
    ///   ဘယ်တော့မှ မရေးဘူး (games.js မှာ တွက်ပြီးသား ranking ကို ရေးတယ်)。
    /// ★ Row တစ်ခုချင်း သီးခြား insert မလုပ်ဘူး — player ၂၀ ဆိုရင် round
    ///   trip ၂၀ ဖြစ်မယ်။ တစ်ခါတည်း multi-row insert လုပ်တယ်။
    /// ★ ဧည့်သည်လည်း မှတ်တယ် — `user_id` က text၊ profiles ကို FK မချိတ်ဘူး။
    async saveGameScores(gameId, rankings) {
      if (!rankings?.length) return;
      const values = [];
      const params = [gameId];
      for (const r of rankings) {
        const base = params.length;
        values.push(`($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        params.push(
          String(r.playerId),
          r.name ?? null,
          Math.max(0, Math.round(Number(r.score) || 0)),
          Math.max(1, Math.round(Number(r.rank) || 1)),
        );
      }
      await q(
        `insert into public.mv_game_scores (game_id, user_id, name, score, rank)
         values ${values.join(", ")}`,
        params,
      );
    },

    /// PII — chat log ကို ၃၀ ရက်ပြီးရင် ဖျက်တယ် (security checklist)။
    async purgeOldChat() {
      const res = await q(
        `delete from public.mv_chat_log where at < now() - interval '${RETENTION_DAYS} days'`,
      );
      return res?.rowCount ?? 0;
    },

    async close() {
      await pool.end().catch(() => {});
    },
  };
}

module.exports = { createStore, chooseSsl, RETENTION_DAYS };
