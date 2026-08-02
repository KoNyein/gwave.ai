/// SIWE message ရဲ့ ပုံစံ (Phase W2)。
///
/// Run: `node --experimental-strip-types --test src/lib/metaverse/siwe.test.ts`
///
/// ★ ဒီ test တွေက **လုံခြုံရေး လိုအပ်ချက်တွေကို ချည်ထားတာ**。 Message
///   format က client နဲ့ server နှစ်ဖက်လုံးက တူညီရမယ်၊ ပြီးတော့ domain
///   နဲ့ chain မပါဘဲ ဖြစ်လို့မရဘူး — မပါရင် တခြား site တစ်ခုမှာ ရထားတဲ့
///   signature ကို gwave မှာ ပြန်သုံးလို့ ရသွားမယ် (phishing)。

import test from "node:test";
import assert from "node:assert";

import {
  DEFAULT_CHAIN_ID,
  ISSUED_AT_TOLERANCE_MS,
  NONCE_TTL_MS,
  SIWE_DOMAIN,
  siweMessage,
} from "./siwe.ts";

const base = {
  address: "0x1a2b3c4d5e6f70000000000000000000000009f8",
  nonce: "abc123",
  issuedAt: "2026-08-02T00:00:00.000Z",
  chainId: DEFAULT_CHAIN_ID,
};

test("message ထဲမှာ domain, chain, nonce, အချိန် အားလုံး ပါရမယ်", () => {
  const msg = siweMessage(base);
  assert.ok(msg.includes(`Domain: ${SIWE_DOMAIN}`), "domain မပါဘူး");
  assert.ok(msg.includes(`Chain: ${DEFAULT_CHAIN_ID}`), "chain id မပါဘူး");
  assert.ok(msg.includes(`Nonce: ${base.nonce}`), "nonce မပါဘူး");
  assert.ok(msg.includes(base.issuedAt), "အချိန် မပါဘူး");
  assert.ok(msg.includes(base.address), "address မပါဘူး");
});

test("★ 'ငွေကုန်ကျမှု မရှိ' ဆိုတာ စာထဲမှာ ပါရမယ်", () => {
  // User အများစုက အတည်ပြုခိုင်းတာကို "ငွေထုတ်တာ" လို့ ထင်ပြီး
  // ပယ်ဖျက်ကြတယ်။ Wallet က ဒီစာကို အတိုင်း ပြတာမို့ ဒီမှာ ကြိုပြောမှ
  // အဆင်ပြေမယ်။
  const msg = siweMessage(base);
  assert.ok(msg.includes("ငွေကြေးလွှဲပြောင်းမှု မဟုတ်ပါ"));
  assert.ok(msg.includes("ကုန်ကျစရိတ် မရှိပါ"));
});

test("input တစ်ခုချင်း ပြောင်းရင် message ပြောင်းရမယ်", () => {
  const msg = siweMessage(base);
  for (const [key, value] of Object.entries({
    address: "0x0000000000000000000000000000000000000001",
    nonce: "different",
    issuedAt: "2026-08-02T01:00:00.000Z",
    chainId: 84532,
  })) {
    const other = siweMessage({ ...base, [key]: value });
    assert.notEqual(other, msg, `${key} ပြောင်းလည်း message တူနေတယ်`);
  }
});

test("message က တည်ငြိမ်ရမယ် (byte တစ်လုံးမှ မကွာရ)", () => {
  // ★ Client နဲ့ server က တစ်လုံးကွာရင် signature မကိုက်တော့ဘူး။ ဒီ
  //   ဖိုင်ကို ပြင်လိုက်ရင် ဒီ test က ကျမယ် — ကျရင် **နှစ်ဖက်စလုံး
  //   deploy ပြီးမှ** merge ရမယ်ဆိုတာ သတိရဖို့။
  assert.equal(
    siweMessage(base).split("\n").length,
    9,
    "စာကြောင်းအရေအတွက် ပြောင်းသွားတယ် — client/server နှစ်ဖက် ကိုက်လား စစ်ပါ",
  );
});

test("nonce သက်တမ်းက issuedAt ခွင့်ပြုချက်ထက် တိုရမယ်", () => {
  // ★ Nonce က ၅ မိနစ်နဲ့ ကုန်တယ်၊ ဒါပေမယ့် issuedAt tolerance က ၁၀
  //   မိနစ်။ ပြောင်းပြန်ဖြစ်သွားရင် သက်တမ်းကုန်ပြီးသား nonce ကို
  //   အချိန်တံဆိပ်နဲ့ လက်ခံမိမယ်။
  assert.ok(NONCE_TTL_MS < ISSUED_AT_TOLERANCE_MS);
});
