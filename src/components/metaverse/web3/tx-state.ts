/// Phase W8.2 — blockchain လုပ်ဆောင်ချက်တစ်ခုရဲ့ အခြေအနေ စက်ရုပ်။
///
/// ★ **`submitted` နဲ့ `success` ကို ခွဲထားရမယ်** — ပို့ပြီးတာနဲ့
///   အောင်မြင်တာ မတူဘူး။ ဒါက Phase W3 ရဲ့ server bug ရဲ့ UI ဘက်ပုံစံပါ:
///   "ပို့ပြီးပြီ" ကို "ရပြီ" လို့ ပြလိုက်ရင် tx က revert ဖြစ်တဲ့အခါ
///   user က ပစ္စည်း မရဘဲ ရပြီလို့ ထင်နေမယ်။
/// ★ အခြေအနေတိုင်းမှာ **user လုပ်စရာ တစ်ခု** ရှိရမယ် — "မအောင်မြင်ပါ"
///   ချည်း ပြပြီး ဘာလုပ်ရမှန်း မပြောရင် ခလုတ်ကို ထပ်ခါထပ်ခါ နှိပ်တယ်။

export type TxState =
  | { s: "idle" }
  | { s: "preparing" }
  | { s: "awaiting_signature" }
  | { s: "submitted"; hash: string }
  | { s: "confirming"; hash: string; confirmations: number; needed: number }
  | { s: "success"; hash: string; result?: unknown }
  | { s: "rejected" }
  | { s: "failed"; reason: string; retryable: boolean };

/// UI မှာ ပြမယ့် မြန်မာစာ။
///
/// ★ **နည်းပညာစကားလုံး တစ်ခုမှ မပါရ** — "transaction", "gas", "sign",
///   "wallet", "mint" ဆိုတာတွေက ဒီဘက်က user အများစုအတွက် အဓိပ္ပာယ်
///   မရှိရုံမက ကြောက်စရာ ဖြစ်တယ် (ငွေနဲ့ဆိုင်တယ်လို့ ထင်ကြတယ်)。
export function txCopy(state: TxState): { title: string; hint?: string } {
  switch (state.s) {
    case "idle":
      return { title: "ပိုင်ဆိုင်မှု အတည်ပြုရန်" };
    case "preparing":
      return { title: "ပြင်ဆင်နေသည်…" };
    case "awaiting_signature":
      return {
        title: "ဖုန်းမှာ အတည်ပြုပါ",
        hint: "သင့်ဖုန်းတွင် ပေါ်လာသော အတည်ပြုချက်ကို နှိပ်ပါ။",
      };
    case "submitted":
      return { title: "ပို့ပြီးပါပြီ — အတည်ပြုနေသည်" };
    case "confirming":
      return {
        title: `အတည်ပြုနေသည် (${state.confirmations}/${state.needed})`,
        hint: `ခန့်မှန်း ${Math.max(2, (state.needed - state.confirmations) * 2)} စက္ကန့်`,
      };
    case "success":
      return { title: "ပြီးပါပြီ" };
    case "rejected":
      return { title: "ပယ်ဖျက်လိုက်ပါသည်", hint: "ပြန်ကြိုးစားနိုင်ပါသည်။" };
    case "failed":
      return { title: "မအောင်မြင်ပါ", hint: state.reason };
  }
}

/// ★ လုပ်နေဆဲလား — ဟုတ်ရင် ခလုတ်ကို ပိတ်ထားရမယ်၊ မဟုတ်ရင် user က
///   ထပ်နှိပ်ပြီး တစ်ခုတည်းသောအရာကို ၂ ခါ လုပ်မိမယ်။
export function txBusy(state: TxState): boolean {
  return (
    state.s === "preparing" ||
    state.s === "awaiting_signature" ||
    state.s === "submitted" ||
    state.s === "confirming"
  );
}

/// အမှားအမျိုးအစား — copy ကို ဒီကနေ ရွေးတယ်။
export type WalletErrorCode =
  | "rejected" // user က ငြင်းလိုက်တာ (အမှား မဟုတ်)
  | "unavailable" // ဒီ device မှာ လုပ်လို့မရ
  | "sign_failed"
  | "verify_failed"
  | "taken" // တခြားအကောင့်နဲ့ ချိတ်ထားပြီး
  | "expired"
  | "network"
  | "wrong_chain";

/// ★ W8.3 ရဲ့ error ဇယား — ဘယ်ဟာမှ နည်းပညာစကားလုံး မပါဘူး၊
///   အားလုံးမှာ လုပ်စရာ တစ်ခု ပါတယ်။
export const WALLET_ERROR_COPY: Record<WalletErrorCode, { text: string; retryable: boolean }> = {
  rejected: { text: "ပယ်ဖျက်လိုက်ပါသည်", retryable: true },
  unavailable: {
    text: "ဤစက်တွင် ဆောင်ရွက်၍ မရပါ — ပိုင်ဆိုင်မှု မချိတ်ဘဲ ဆက်သုံးနိုင်ပါသည်",
    retryable: false,
  },
  sign_failed: { text: "အတည်ပြု၍ မရပါ — ပြန်ကြိုးစားပါ", retryable: true },
  verify_failed: { text: "အတည်ပြုချက် မမှန်ကန်ပါ — ပြန်ကြိုးစားပါ", retryable: true },
  taken: {
    text: "ဤပိုင်ဆိုင်မှုကို အခြားအကောင့်တစ်ခုနှင့် ချိတ်ထားပြီးဖြစ်ပါသည်",
    retryable: false,
  },
  expired: { text: "အချိန်ကုန်သွားပါပြီ — ပြန်ကြိုးစားပါ", retryable: true },
  network: { text: "ကွန်ရက် ခေတ္တပြဿနာ — ပြန်ကြိုးစားပါ", retryable: true },
  wrong_chain: { text: "ကွန်ရက် မကိုက်ညီပါ", retryable: true },
};

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly retryable: boolean;
  /// မြန်မာလို ပြရမယ့် စာ — `message` က log အတွက်၊ ဒါက user အတွက်။
  readonly display: string;

  constructor(code: WalletErrorCode, detail?: string) {
    const copy = WALLET_ERROR_COPY[code];
    super(detail ? `${code}: ${detail}` : code);
    this.name = "WalletError";
    this.code = code;
    this.retryable = copy.retryable;
    this.display = copy.text;
  }
}

/// Address ကို အတိုပြ — `0x1a2b…9f8e`。
/// ★ အပြည့်ပြရင် ဖုန်းမှာ layout ပျက်ပြီး ဘာမှလည်း ပိုမသိရဘူး။
export function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
