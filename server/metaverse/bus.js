"use strict";

/// Room bus — task များခုကြားမှာ message မျှဝေဖို့ (spec 6.2)။
///
/// ★ ဘာလို့ လိုလဲ: player ရဲ့ state က **task ရဲ့ memory ထဲမှာ** ရှိတယ်။
///   Task ၂ လုံးဆိုရင် task A ကလူတွေက task B ကလူတွေကို လုံးဝမမြင်ရဘူး —
///   တစ်လောကထဲမှာ ရှိပေမယ့် တစ်ယောက်နဲ့တစ်ယောက် မတွေ့တဲ့ လောက ၂ ခု
///   ဖြစ်နေမယ်။ ALB stickiness က player ၂၀၀ လောက်အထိ ဖုံးပေးနိုင်ပေမယ့်
///   ဒီထက်များရင် task ခွဲမှ ဖြစ်တယ်။
/// ★ **REDIS_URL မရှိရင် ဘာမှမလုပ်ဘူး** — task တစ်လုံးတည်းက ပုံမှန်
///   အလုပ်လုပ်တယ်။ ElastiCache က ကုန်ကျစရိတ်ရှိလို့ player နည်းနေသေးတဲ့
///   အချိန်မှာ မလိုအပ်ဘူး။
/// ★ **ကိုယ်ပို့တဲ့ message ကို ကိုယ်ပြန်မယူရ** — Redis က publisher ဆီကိုပါ
///   ပြန်ပို့တယ်။ မစစ်ရင် local player တွေက message တိုင်းကို ၂ ခါ ရမယ်
///   (chat တစ်ခေါက်ကို ၂ ကြောင်း၊ position update ခုန်ခုန်)။ ဒါကြောင့်
///   envelope ထဲမှာ origin id ထည့်ပြီး ကိုယ့်ဟာကို ချန်တယ်။

const crypto = require("crypto");

/// ဒီ process ရဲ့ ကိုယ်ပိုင် id — Redis echo ကို ခွဲဖို့
const ORIGIN = crypto.randomBytes(8).toString("hex");

function nullBus() {
  return {
    enabled: false,
    origin: ORIGIN,
    async start() {},
    publish() {},
    async close() {},
  };
}

/// `onRemote(roomId, msg)` က တခြား task ကနေ လာတဲ့ message တိုင်းအတွက်
/// ခေါ်တယ် — ကိုယ့်ဟာကို စစ်ပြီးသား ဖြစ်တယ်။
function createBus(redisUrl, rooms, onRemote) {
  if (!redisUrl) return nullBus();

  // ★ `redis` package မရှိရင် server က မတက်ဘဲ မဖြစ်စေရ — bus မရှိတာက
  // အလုပ်လုပ်နိုင်တဲ့ အခြေအနေတစ်ခု ဖြစ်တယ် (task တစ်လုံး)။
  let redis;
  try {
    redis = require("redis");
  } catch {
    console.error("[mv/bus] REDIS_URL is set but the 'redis' package is missing");
    return nullBus();
  }

  const pub = redis.createClient({ url: redisUrl });
  const sub = pub.duplicate();
  let ready = false;

  for (const [name, client] of [
    ["pub", pub],
    ["sub", sub],
  ]) {
    // ★ error handler မထားရင် ချိတ်မရတာနဲ့ process တစ်ခုလုံး ကျမယ်
    client.on("error", (err) => {
      console.error(`[mv/bus] ${name}:`, err.message);
    });
  }

  return {
    enabled: true,
    origin: ORIGIN,

    async start() {
      await pub.connect();
      await sub.connect();
      for (const roomId of rooms) {
        await sub.subscribe(`mv:${roomId}`, (data) => {
          let env;
          try {
            env = JSON.parse(data);
          } catch {
            return;
          }
          // ကိုယ်ပို့ခဲ့တာကို ကိုယ်ပြန်မယူဘူး
          if (!env || env.o === ORIGIN || !env.m) return;
          onRemote(roomId, env.m, env.o);
        });
      }
      ready = true;
      console.log(`[mv/bus] subscribed to ${rooms.size} room channel(s)`);
    },

    /// ★ fire-and-forget — publish ကို await လုပ်ရင် Redis နှေးတိုင်း
    /// လောကတစ်ခုလုံး ရပ်သွားမယ်။
    publish(roomId, msg) {
      if (!ready) return;
      pub
        .publish(`mv:${roomId}`, JSON.stringify({ o: ORIGIN, m: msg }))
        .catch((err) => console.error("[mv/bus] publish:", err.message));
    },

    async close() {
      ready = false;
      await Promise.allSettled([pub.quit(), sub.quit()]);
    },
  };
}

module.exports = { createBus, ORIGIN };
