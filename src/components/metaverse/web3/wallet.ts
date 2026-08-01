import { siweMessage } from "@/lib/metaverse/siwe";

/// Wallet ချိတ်ဆက်ခြင်း — **EIP-1193 injected provider** (`window.ethereum`)။
///
/// ★ Spec က wagmi + @web3modal ကို ညွှန်းထားပေမယ့် ဒီမှာ မသုံးဘူး၊ အကြောင်း ၃ ချက်:
///   1. WalletConnect က **cloud project id** လိုတယ် — user တစ်ယောက်က
///      account ဖွင့်ပြီး secret ထုတ်ရမယ်။ မရှိဘဲ code ရေးထားရင် ဖွင့်တဲ့အခါ
///      ချက်ချင်း ကျမယ်၊ ဒီမှာ စမ်းလို့လည်း မရဘူး။
///   2. wagmi + react-query + web3modal က bundle ကို ~၃၀၀KB တိုးစေတယ် —
///      wallet မသုံးတဲ့ လူအများစုအတွက် အလကားဝန်ထုပ်။
///   3. ဗမာပြည်/ထိုင်းဘက်မှာ အသုံးများတာက MetaMask, Trust, Coinbase ရဲ့
///      **အတွင်း browser** — အဲဒါတွေမှာ `window.ethereum` ရှိပြီးသား။
///   WalletConnect ထပ်လိုရင် ဒီ file ရဲ့ `connect()` ကိုပဲ ပြောင်းရမယ်၊
///   ကျန်တဲ့ flow (nonce → sign → verify) က အတူတူပဲ။
/// ★ **Private key / seed phrase ကို ဘယ်တော့မှ မတောင်းဘူး၊ မကိုင်ဘူး။**
///   စာတစ်ကြောင်း လက်မှတ်ထိုးခိုင်းရုံပဲ။

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

function provider(): Eip1193 | null {
  const w = window as unknown as { ethereum?: Eip1193 };
  return w.ethereum ?? null;
}

export function walletAvailable(): boolean {
  return typeof window !== "undefined" && provider() !== null;
}

export type LinkResult =
  | { ok: true; wallet: string }
  | { ok: false; reason: string };

/// အသုံးပြုသူက ငြင်းလိုက်တာ (code 4001) က **အမှား မဟုတ်ဘူး** — ပုံမှန်
/// ရွေးချယ်မှုတစ်ခုပဲ။ ဒါကို error အဖြစ် ပြရင် လူတွေ ကြောက်သွားမယ်။
const USER_REJECTED = 4001;

function reason(err: unknown, fallback: string): string {
  const code = (err as { code?: number } | null)?.code;
  if (code === USER_REJECTED) return "ပယ်ဖျက်လိုက်ပါတယ်";
  const msg = (err as { message?: string } | null)?.message;
  return msg ? msg.slice(0, 120) : fallback;
}

/// Wallet ကို Gwave အကောင့်နဲ့ ချိတ်တယ် — nonce → sign → server verify။
export async function linkWallet(): Promise<LinkResult> {
  const eth = provider();
  if (!eth) {
    return { ok: false, reason: "ဒီ browser မှာ wallet မရှိပါ" };
  }

  // ── 1. Address ──────────────────────────────────────────────────────────
  let address: string;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const first = accounts?.[0];
    if (!first) return { ok: false, reason: "wallet မရွေးရသေးပါ" };
    address = first;
  } catch (err) {
    return { ok: false, reason: reason(err, "wallet ကို ချိတ်လို့ မရပါ") };
  }

  // ── 2. Nonce (server က ထုတ်တယ်) ────────────────────────────────────────
  let nonce: string;
  let issuedAt: string;
  try {
    const res = await fetch("/api/metaverse/siwe/nonce", {
      method: "POST",
      cache: "no-store",
    });
    const json = (await res.json()) as { nonce?: string; issuedAt?: string; error?: string };
    if (!res.ok || !json.nonce || !json.issuedAt) {
      return { ok: false, reason: json.error ?? "nonce မရပါ" };
    }
    nonce = json.nonce;
    issuedAt = json.issuedAt;
  } catch {
    return { ok: false, reason: "server ကို မရောက်ပါ" };
  }

  // ── 3. Sign ─────────────────────────────────────────────────────────────
  const message = siweMessage({ address, nonce, issuedAt });
  let signature: string;
  try {
    // ★ `personal_sign` ရဲ့ parameter အစဉ်က [message, address] —
    // ပြောင်းပြန်ထည့်ရင် wallet အချို့က တိတ်တိတ်ပဲ မှားတဲ့ရလဒ် ပြန်ပေးတယ်။
    signature = (await eth.request({
      method: "personal_sign",
      params: [message, address],
    })) as string;
  } catch (err) {
    return { ok: false, reason: reason(err, "လက်မှတ်မထိုးရသေးပါ") };
  }

  // ── 4. Server verify ────────────────────────────────────────────────────
  try {
    const res = await fetch("/api/metaverse/siwe/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature, nonce, issuedAt }),
    });
    const json = (await res.json()) as { ok?: boolean; wallet?: string; error?: string };
    if (!res.ok || !json.ok || !json.wallet) {
      return { ok: false, reason: json.error ?? "စစ်ဆေးမှု မအောင်မြင်ပါ" };
    }
    return { ok: true, wallet: json.wallet };
  } catch {
    return { ok: false, reason: "server ကို မရောက်ပါ" };
  }
}

/// လက်ရှိချိတ်ထားတဲ့ wallet — ★ ဒါက **ပြသဖို့သာ**။ ပိုင်ဆိုင်မှုစစ်ဆေးမှု
/// မှန်သမျှက server ဘက်မှာသာ ဖြစ်ရမယ် (client က "ငါပိုင်တယ်" ပြောတာ
/// ဘယ်တော့မှ မယုံရ)။
export async function currentWallet(): Promise<string | null> {
  const eth = provider();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function shortWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
