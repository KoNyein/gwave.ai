"use strict";

const crypto = require("crypto");

/// WS ticket စစ်ခြင်း။
///
/// Browser ရဲ့ WebSocket API က header ထည့်လို့မရဘူး — ဒါကြောင့် token ကို URL
/// မှာထည့်ရတယ်။ ဒါပေမယ့် URL က ALB access log, CloudWatch, proxy log တွေထဲ
/// အကုန်ဝင်တတ်လို့ **Cognito access token ကို URL မှာ တိုက်ရိုက်မထည့်ရ**။
///
/// အစား သက်တမ်း ၆၀ စက္ကန့်ပဲရှိတဲ့ ticket တစ်ခုကို web app (Next.js) က
/// ထုတ်ပေးတယ် — log ထဲပေါက်သွားရင်တောင် တစ်မိနစ်အတွင်း သုံးမရတော့ဘူး။
/// Ticket ထုတ်တဲ့နေရာ: `src/app/api/metaverse/ws-ticket/route.ts` (Phase 3)။
///
/// Phase 3 မှာ Cognito JWT verify ထပ်ထည့်မယ် (`aws-jwt-verify`)။ အခုက
/// HMAC ticket အဆင့်ပဲ — REQUIRE_AUTH=false ဆိုရင် guest အဖြစ်ဝင်လို့ရတယ်။

const TICKET_TTL_MS = 60_000;

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/// HS256 JWT ကို ကိုယ်တိုင်စစ် — dependency တစ်ခုတောင် မလိုဘူး၊ format က
/// သေးသေးလေး ဖြစ်လို့။ ★ signature အရင်စစ်ပြီးမှ payload ကို ယုံရမယ်။
function verifyTicket(ticket, secret) {
  if (!ticket || typeof ticket !== "string") return null;
  const parts = ticket.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest("base64url");

  // ★ timing-safe compare — ရိုးရိုး === က byte တစ်ခုချင်း ဘယ်လောက်ကိုက်လဲ
  // ဆိုတာ အချိန်ကနေ ခန့်မှန်းလို့ရတယ်။
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  } catch {
    return null;
  }

  const now = Date.now();
  if (typeof payload.exp === "number" && payload.exp * 1000 < now) return null;
  // ထုတ်ချိန်ကနေ ၆၀ စက္ကန့်ထက်ကျော်ရင် exp မပါလည်း ငြင်း
  if (typeof payload.iat === "number" && now - payload.iat * 1000 > TICKET_TTL_MS) {
    return null;
  }
  if (!payload.sub) return null;

  return {
    userId: String(payload.sub),
    name: String(payload.name || payload.username || "Gwave"),
  };
}

/// Connection တစ်ခုကို ဘယ်သူလဲ ဆုံးဖြတ်ပေးတယ်။
///
/// Return: { userId, name, authed } — ဒါမှမဟုတ် null (ဝင်ခွင့်မရှိ)
function identify({ ticket, requireAuth, secret, guestId }) {
  if (ticket && secret) {
    const claims = verifyTicket(ticket, secret);
    if (claims) return { ...claims, authed: true };
    // ★ ticket ပါလာပြီး မမှန်ရင် guest အဖြစ် **မကျဆင်းရ** — မဟုတ်ရင်
    // ပျက်နေတဲ့ ticket တစ်ခုနဲ့ ဘယ်သူမဆို ဝင်လို့ရသွားမယ်။
    return null;
  }
  if (requireAuth) return null;
  return { userId: guestId, name: "Guest", authed: false };
}

module.exports = { identify, verifyTicket, TICKET_TTL_MS };
