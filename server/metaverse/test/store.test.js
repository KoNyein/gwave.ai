"use strict";

/// Persistence — Phase 4။
/// ဒီ test တွေက DB မလိုဘူး။ RDS နဲ့ တကယ်ချိတ်တဲ့ စစ်ဆေးမှုက README ထဲမှာ။

const test = require("node:test");
const assert = require("node:assert");
const { createStore, chooseSsl } = require("../store");

test("DATABASE_URL မရှိရင် ဘာမှမလုပ်တဲ့ store ရတယ် (လောကက ဆက်အလုပ်လုပ်တယ်)", async () => {
  const store = createStore("");
  assert.strictEqual(store.enabled, false);
  // ★ ခေါ်တဲ့ဘက်မှာ `if (store)` စစ်စရာမလိုအောင် API က တူညီရမယ်
  assert.strictEqual(await store.loadPlayer("u_1"), null);
  assert.deepStrictEqual(await store.getPlotsAround(0, 0, 2), []);
  assert.strictEqual(await store.purgeOldChat(), 0);
  await store.savePlayer("u_1", { x: 1 });
  await store.logChat("u_1", "A", "city", "hi");
  await store.close();
});

test("undefined / null URL ကိုလည်း ခံနိုင်တယ်", () => {
  assert.strictEqual(createStore(undefined).enabled, false);
  assert.strictEqual(createStore(null).enabled, false);
});

test("sslmode ရေးထားရင် အတင်း override မလုပ်ဘူး", () => {
  // undefined = pg ကို ကိုယ်တိုင် ဆုံးဖြတ်ခိုင်းတယ်
  assert.strictEqual(chooseSsl("postgres://u@rds.example.com/db?sslmode=require"), undefined);
  assert.strictEqual(chooseSsl("postgres://u@rds.example.com/db?a=1&sslmode=disable"), undefined);
});

test("unix socket / localhost မှာ TLS မဖွင့်ဘူး", () => {
  // ★ ဖွင့်လိုက်ရင် "server does not support SSL connections" နဲ့ ကျမယ်
  assert.strictEqual(chooseSsl("postgres://postgres@/postgres?host=/tmp&port=55432"), false);
  assert.strictEqual(chooseSsl("postgres://postgres@/postgres?host=%2Ftmp"), false);
  assert.strictEqual(chooseSsl("postgres://u:p@localhost:5432/db"), false);
  assert.strictEqual(chooseSsl("postgres://u:p@127.0.0.1:5432/db"), false);
});

test("RDS host မှာ TLS ဖွင့်တယ်", () => {
  const ssl = chooseSsl("postgres://u:p@gwave.abc123.ap-southeast-1.rds.amazonaws.com:5432/postgres");
  assert.deepStrictEqual(ssl, { rejectUnauthorized: false });
});
