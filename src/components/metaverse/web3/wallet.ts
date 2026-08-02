import { siweMessage } from "@/lib/metaverse/siwe";

import { WalletError, type WalletErrorCode } from "./tx-state";

/// Phase W1 + W2 — ပိုင်ဆိုင်မှု ချိတ်ဆက်ခြင်း။
///
/// ★ **နည်းလမ်း ၂ ခု**
///   1. `smart` — Coinbase Smart Wallet (passkey)。 App install မလို၊
///      seed phrase မလို၊ ဖုန်းရဲ့ လက်ဗွေ/မျက်နှာ တစ်ချက်နဲ့ ပြီးတယ်။
///      ★ Gwave ရဲ့ user အများစုမှာ crypto wallet မရှိဘူး — ဒါက
///      သူတို့အတွက် တစ်ခုတည်းသော လက်တွေ့ကျတဲ့ လမ်းကြောင်း။
///   2. `external` — `window.ethereum` (MetaMask, Trust, Coinbase ရဲ့
///      အတွင်း browser)。 ရှိပြီးသားသူတွေအတွက်။
/// ★ **SDK ကို lazy import လုပ်တယ်** — Coinbase SDK က ကြီးတယ်။ ပိုင်ဆိုင်မှု
///   မချိတ်တဲ့ လူအများစု (= အများစု) အဲဒါကို ဘယ်တော့မှ မဆွဲရဘူး။
///   ဒါကြောင့် wagmi/web3modal ကို မသုံးဘူး — အဲဒါတွေက app boot
///   အချိန်မှာ provider tree ထဲ ဝင်နေရပြီး ရွေးစရာ မရှိတော့ဘူး။
/// ★ **Passkey ရဲ့ အန္တရာယ်** (W1.2) — device-bound passkey က ဖုန်းပျောက်ရင်
///   ပြန်မရဘူး။ ဒါကြောင့် **ဝယ်ထားတဲ့ပစ္စည်းက `mv_inventory` (RDS) မှာ
///   ရှိပြီး on-chain က အပိုသက်သေသာ** ဖြစ်ရမယ်။ ဒီ file ကနေ ဖြစ်လာတဲ့
///   ဘာမှ user ရဲ့ ပစ္စည်းကို မထိဘူး။
/// ★ **Private key / seed phrase ကို ဘယ်တော့မှ မတောင်းဘူး၊ မကိုင်ဘူး။**

export type Connector = "smart" | "external";

export type LinkStage =
  | "connecting" // provider ဖွင့်နေတယ် (passkey prompt ပေါ်နိုင်တယ်)
  | "signing" // စာကို အတည်ပြုခိုင်းနေတယ်
  | "verifying"; // server ဘက် စစ်နေတယ်

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

/// EIP-1193 ရဲ့ "user က ငြင်းလိုက်တယ်" code။ ★ ဒါက **အမှား မဟုတ်ဘူး** —
/// ပုံမှန် ရွေးချယ်မှုတစ်ခုပဲ။ အနီရောင်နဲ့ ပြရင် လူတွေ ကြောက်သွားမယ်။
const USER_REJECTED = 4001;

function injected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: Eip1193 };
  return w.ethereum ?? null;
}

/// ရှိပြီးသား wallet app တစ်ခု ဒီ browser မှာ ရှိလား။
export function walletAvailable(): boolean {
  return injected() !== null;
}

/// Passkey (WebAuthn) ကို ဒီ device က ထောက်ပံ့လား။
///
/// ★ Android 8 လို ဖုန်းအဟောင်းတွေမှာ မရှိဘူး။ မရှိရင် **error မတက်ဘဲ**
///   "မချိတ်ဘဲ ဆက်သုံးရန်" ကို ပြရမယ် (W1.4)。 ချိတ်ခိုင်းပြီး ကျရှုံးတာက
///   အဆိုးဆုံး — user က "ဒီ app က ပျက်နေတယ်" လို့ ထင်မယ်။
export function smartWalletSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PublicKeyCredential === "function" && window.isSecureContext === true
  );
}

let smartProvider: Eip1193 | null = null;

/// Coinbase Smart Wallet ရဲ့ provider — ★ တစ်ခါပဲ ဆောက်တယ်။
async function smartWallet(): Promise<Eip1193> {
  if (smartProvider) return smartProvider;
  if (!smartWalletSupported()) throw new WalletError("unavailable");

  let createSdk: (o: unknown) => { getProvider(): Eip1193 };
  try {
    const mod = await import("@coinbase/wallet-sdk");
    createSdk = mod.createCoinbaseWalletSDK as typeof createSdk;
  } catch {
    // ★ Chunk ကို မဆွဲနိုင်ရင် (network ကျတာ) — "ဒီစက်မှာ မရဘူး" လို့ပဲ
    //   ပြတယ်၊ user က ဘာမှ လုပ်စရာ မရှိလို့။
    throw new WalletError("unavailable", "SDK ကို မဆွဲနိုင်ဘူး");
  }

  const instance = createSdk({
    appName: "Gwave Metaverse",
    appLogoUrl: "https://gwave.cc/icon-192.png",
    appChainIds: [Number(process.env.NEXT_PUBLIC_WEB3_CHAIN_ID) || 8453],
    // ★ `smartWalletOnly` — extension ကို မမေးဘဲ passkey wallet ကို
    //   တန်း ဖွင့်တယ်။ `all` ဆိုရင် ရွေးစရာ ၂ ခု ပေါ်ပြီး ရှုပ်တယ်
    //   (ပြင်ပ wallet အတွက် သီးခြားခလုတ် ရှိပြီးသား)。
    preference: { options: "smartWalletOnly" },
  });

  smartProvider = instance.getProvider();
  return smartProvider;
}

async function providerFor(connector: Connector): Promise<Eip1193> {
  if (connector === "smart") return smartWallet();
  const eth = injected();
  if (!eth) throw new WalletError("unavailable", "injected provider မရှိဘူး");
  return eth;
}

function isRejection(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === USER_REJECTED) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === "UserRejectedRequestError" || name === "NotAllowedError";
}

/// Server ရဲ့ status code ကို user ဘက် အမှားအမျိုးအစားအဖြစ် ပြောင်းတယ်။
function codeForStatus(status: number): WalletErrorCode {
  if (status === 409) return "taken";
  if (status === 401) return "expired";
  return "verify_failed";
}

export type LinkedWallet = { wallet: string; linkedAt: string };

/// ပိုင်ဆိုင်မှုကို Gwave အကောင့်နဲ့ ချိတ်တယ် — nonce → အတည်ပြု → server စစ်။
///
/// ★ အဆင့်တိုင်းကို `onStage` နဲ့ ပြန်ပြောတယ် — blockchain က နှေးလို့
///   ဘာဖြစ်နေလဲ မပြရင် user က ခလုတ်ကို ထပ်နှိပ်တယ် (W8.0 စည်းမျဉ်း ၂)。
/// ★ ကျရှုံးရင် `WalletError` throw တယ် — ခေါ်သူက `.display` ကို
///   တိုက်ရိုက် ပြလို့ရတယ်။
export async function linkWallet(
  connector: Connector,
  onStage?: (stage: LinkStage) => void,
): Promise<LinkedWallet> {
  onStage?.("connecting");
  const eth = await providerFor(connector);

  // ── 1. Address ────────────────────────────────────────────────────────
  let address: string;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const first = accounts?.[0];
    if (!first) throw new WalletError("rejected");
    address = first;
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError(isRejection(err) ? "rejected" : "unavailable");
  }

  // ── 2. Nonce (server က ထုတ်တယ်) ──────────────────────────────────────
  let nonce: string;
  let issuedAt: string;
  let chainId: number;
  try {
    const res = await fetch("/api/metaverse/siwe/nonce", {
      method: "POST",
      cache: "no-store",
    });
    const json = (await res.json()) as {
      nonce?: string;
      issuedAt?: string;
      chainId?: number;
      error?: string;
    };
    if (!res.ok || !json.nonce || !json.issuedAt || !json.chainId) {
      throw new WalletError(codeForStatus(res.status), json.error);
    }
    nonce = json.nonce;
    issuedAt = json.issuedAt;
    chainId = json.chainId;
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError("network");
  }

  // ── 3. အတည်ပြုချက် ────────────────────────────────────────────────────
  onStage?.("signing");
  const message = siweMessage({ address, nonce, issuedAt, chainId });
  let signature: string;
  try {
    // ★ `personal_sign` ရဲ့ parameter အစဉ်က [message, address] —
    // ပြောင်းပြန်ထည့်ရင် wallet အချို့က တိတ်တိတ်ပဲ မှားတဲ့ရလဒ် ပြန်ပေးတယ်။
    signature = (await eth.request({
      method: "personal_sign",
      params: [message, address],
    })) as string;
  } catch (err) {
    throw new WalletError(isRejection(err) ? "rejected" : "sign_failed");
  }

  // ── 4. Server verify ──────────────────────────────────────────────────
  onStage?.("verifying");
  try {
    const res = await fetch("/api/metaverse/siwe/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature, nonce, issuedAt }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      wallet?: string;
      linkedAt?: string;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.wallet) {
      throw new WalletError(codeForStatus(res.status), json.error);
    }
    return { wallet: json.wallet, linkedAt: json.linkedAt ?? new Date().toISOString() };
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError("network");
  }
}

/// ချိတ်ထားတာကို ဖြုတ်တယ်။ ★ ပစ္စည်းကို မထိဘူး — RDS မှာ ရှိနေတယ်။
export async function unlinkWallet(): Promise<void> {
  const res = await fetch("/api/metaverse/siwe/unlink", {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new WalletError("network");
}

/// လက်ရှိ ချိတ်ထားတဲ့ address — ★ ဒါက **ပြသဖို့သာ**။ ပိုင်ဆိုင်မှု
/// စစ်ဆေးမှု မှန်သမျှက server ဘက်မှာသာ ဖြစ်ရမယ် (client က "ငါပိုင်တယ်"
/// ပြောတာ ဘယ်တော့မှ မယုံရ)。
export async function currentWallet(): Promise<string | null> {
  const eth = injected();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export { shortAddress as shortWallet } from "./tx-state";
