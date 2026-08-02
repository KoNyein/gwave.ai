/// Phase W8.8 — "UI မှာ crypto ဝေါဟာရ တစ်ခုမှ မပါရ" ဆိုတဲ့ လိုအပ်ချက်။
///
/// Run: `node --experimental-strip-types --test src/components/metaverse/web3/copy.test.ts`
///
/// ★ ဘာလို့ test နဲ့ ချည်ရလဲ — ဒါက **ကြည့်ရုံနဲ့ မသိတဲ့ စည်းမျဉ်း**။
///   နောက်တစ်ယောက်က feature တစ်ခု ထပ်ထည့်တဲ့အခါ "Mint လုပ်မည်" လို့
///   ရေးမိလွယ်တယ် — code review မှာလည်း ပုံမှန်လို ဖြစ်နေမယ်။ ဒါပေမယ့်
///   Gwave ရဲ့ user တွေက အဲဒီစကားလုံးကို မသိရုံမက ငွေနဲ့ဆိုင်တယ်လို့
///   ထင်ပြီး ကြောက်ကြတယ်။
/// ★ စစ်တဲ့နည်း — မြန်မာစာ ပါတဲ့ string literal တွေ (= user မြင်ရတဲ့
///   စာသား) ကိုသာ ကြည့်တယ်။ Code ထဲက `linkWallet` လို identifier တွေက
///   မြန်မာစာ မပါလို့ မပါဝင်ဘူး။

import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/// UI မှာ ဘယ်တော့မှ မပေါ်ရမယ့် စကားလုံးတွေ (W8.0 စည်းမျဉ်း ၁)。
const BANNED = ["wallet", "sign", "gas", "mint", "transaction", "blockchain", "nft"];

/// မြန်မာ ကျမ်းလုံးအပိုင်း — ဒါပါတဲ့ string က user မြင်ရမယ့် စာသား။
const MYANMAR = /[က-႟]/;

/// `"..."`, `'...'`, `` `...` `` သုံးမျိုးလုံးကို ဆွဲထုတ်တယ်။
function stringLiterals(source: string): string[] {
  // ★ Comment တွေကို အရင် ဖယ်တယ် — comment တွေက မြန်မာလို ရေးထားပြီး
  //   "wallet" လို နည်းပညာစကားလုံးတွေ ပါတယ် (developer အတွက်၊ user
  //   အတွက် မဟုတ်ဘူး)。
  const code = source
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const out: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

/// JSX ရဲ့ tag ကြားက စာသား — `>ပိုင်ဆိုင်မှု ချိတ်ရန်<` မျိုး။
function jsxText(source: string): string[] {
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  const re = />([^<>{}]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[1] ?? "");
  return out;
}

function userText(file: string): string[] {
  const source = readFileSync(join(here, file), "utf8");
  return [...stringLiterals(source), ...jsxText(source)].filter((s) => MYANMAR.test(s));
}

const FILES = ["ownership.tsx", "tx-state.ts"];

test("★ user မြင်ရတဲ့ စာသားထဲမှာ crypto ဝေါဟာရ မပါရ", () => {
  for (const file of FILES) {
    for (const text of userText(file)) {
      for (const word of BANNED) {
        assert.ok(
          !new RegExp(`\\b${word}\\b`, "i").test(text),
          `${file}: "${text.trim()}" ထဲမှာ "${word}" ပါနေတယ် — "ပိုင်ဆိုင်မှု" နဲ့ အစားထိုးပါ`,
        );
      }
    }
  }
});

test("စာသားတွေက တကယ် ရှိရမယ် (regex က အလကား အောင်နေတာ မဟုတ်ရ)", () => {
  // ★ ဒါမပါရင် အပေါ်က test က file ဗလာဖြစ်သွားလည်း အစိမ်းရောင် ပြနေမယ်။
  const all = FILES.flatMap(userText);
  assert.ok(all.length > 15, `မြန်မာစာ ${all.length} ကြောင်းပဲ တွေ့တယ် — extractor ပျက်နေတယ်`);
  assert.ok(
    all.some((t) => t.includes("ပိုင်ဆိုင်မှု")),
    "'ပိုင်ဆိုင်မှု' ဆိုတဲ့ အစားထိုးစကားလုံး မတွေ့ဘူး",
  );
});

test("★ မချိတ်ဘဲ ဆက်သုံးလို့ရကြောင်း UI မှာ ပြရမယ်", () => {
  // W8.8 — "Wallet မချိတ်ဘဲ metaverse အပြည့်သုံးလို့ရကြောင်း ထင်ရှား"。
  const texts = userText("ownership.tsx").join("\n");
  assert.ok(texts.includes("ကျော်"), "ကျော်သွားလို့ရတဲ့ ခလုတ် မတွေ့ဘူး");
  assert.ok(
    texts.includes("Metaverse အားလုံး"),
    "မချိတ်ဘဲ အပြည့်သုံးလို့ရကြောင်း ရှင်းပြထားတာ မတွေ့ဘူး",
  );
});
