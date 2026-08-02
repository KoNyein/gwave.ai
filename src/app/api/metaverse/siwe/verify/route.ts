import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { ISSUED_AT_TOLERANCE_MS, siweMessage } from "@/lib/metaverse/siwe";

export const dynamic = "force-dynamic";

/// SIWE အဆင့် ၂ — signature စစ်ပြီး wallet ကို အကောင့်နဲ့ ချိတ်တယ်။
///
/// ★ **Private key / seed phrase ကို ဘယ်တော့မှ မကိုင်ဘူး** — wallet က
///   စာတစ်ကြောင်းကို လက်မှတ်ထိုးပေးရုံပဲ။ ဒီ endpoint က signature ကနေ
///   address ကို ပြန်တွက်ပြီး claim လုပ်တဲ့ address နဲ့ တူလားသာ ကြည့်တယ်။
/// ★ **Nonce က တစ်ခါသုံး** — သုံးပြီးသားဆိုရင် ငြင်းတယ်။ ဒါမရှိရင်
///   signature တစ်ခုကို ပြန်သုံးပြီး ဟန်ဆောင်လို့ရမယ်။
/// ★ **Nonce က ဝင်လာသူရဲ့ ကိုယ်ပိုင်ဖြစ်ရမယ်** — တခြားသူရဲ့ nonce ကို
///   ယူသုံးလို့ မရရ။

const bad = (msg: string, status = 400) =>
  NextResponse.json(
    { error: msg },
    { status, headers: { "cache-control": "no-store, private" } },
  );

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return bad("Gwave အကောင့်နဲ့ အရင်ဝင်ပါ", 401);

  let body: { address?: string; signature?: string; nonce?: string; issuedAt?: string };
  try {
    body = await request.json();
  } catch {
    return bad("JSON မမှန်ပါ");
  }

  const address = String(body.address ?? "");
  const signature = String(body.signature ?? "");
  const nonce = String(body.nonce ?? "");
  const issuedAt = String(body.issuedAt ?? "");
  if (!isAddress(address)) return bad("wallet address မမှန်ပါ");
  if (!signature.startsWith("0x")) return bad("signature မမှန်ပါ");
  if (!nonce || !issuedAt) return bad("nonce သို့မဟုတ် အချိန် မပါပါ");

  const admin = createAdminClient();

  // ── Nonce ────────────────────────────────────────────────────────────────
  const { data: row } = await admin
    .from("mv_wallet_nonces")
    .select("nonce, user_id, created_at, used_at")
    .eq("nonce", nonce)
    .maybeSingle();

  if (!row) return bad("nonce မတွေ့ပါ", 401);
  if (row.used_at) return bad("ဒီ nonce ကို သုံးပြီးသားပါ", 401);
  if (row.user_id !== profile.id) return bad("ဒီ nonce က သင့်အတွက် မဟုတ်ပါ", 401);

  const skew = Math.abs(Date.parse(issuedAt) - Date.parse(row.created_at));
  if (!Number.isFinite(skew) || skew > ISSUED_AT_TOLERANCE_MS) {
    return bad("အချိန်တံဆိပ် မမှန်ပါ", 401);
  }

  // ── Signature ────────────────────────────────────────────────────────────
  let valid = false;
  try {
    valid = await verifyMessage({
      address,
      message: siweMessage({ address, nonce, issuedAt }),
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return bad("signature မမှန်ပါ", 401);

  // ★ signature မှန်ပြီးမှ nonce ကို ပိတ်တယ်။ မမှန်တာကို ပိတ်လိုက်ရင်
  // wallet app က ခဏ ကြန့်ကြာတိုင်း user က nonce အသစ် ပြန်တောင်းရမယ်။
  // ဒါပေမယ့် ★ ပိတ်တာက **update ... is null** နဲ့ ဖြစ်ရမယ် — request ၂ ခု
  // တစ်ပြိုင်နက် ဝင်လာရင် တစ်ခုပဲ အောင်မြင်ရမယ် (race)။
  const { data: claimed } = await admin
    .from("mv_wallet_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("used_at", null)
    .select("nonce");

  if (!claimed || claimed.length === 0) return bad("ဒီ nonce ကို သုံးပြီးသားပါ", 401);

  // ── သိမ်း ────────────────────────────────────────────────────────────────
  // address ကို အသေးစာလုံးနဲ့ သိမ်းတယ် — EIP-55 checksum က စာလုံးအကြီး
  // အသေး ရောနေလို့ ဒီအတိုင်း သိမ်းရင် တစ်ယောက်တည်းရဲ့ wallet ကို ၂ ခု
  // အဖြစ် မှတ်မိမယ်။
  const wallet = address.toLowerCase();
  const { error: saveErr } = await admin
    .from("mv_players")
    .upsert(
      { user_id: profile.id, display_name: profile.username || "Gwave", wallet },
      { onConflict: "user_id" },
    );

  if (saveErr) return bad("သိမ်းလို့ မရပါ", 500);

  return NextResponse.json(
    { ok: true, wallet },
    { headers: { "cache-control": "no-store, private" } },
  );
}
