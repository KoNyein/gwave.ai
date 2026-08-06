// lib/economy/index.ts
// Shared config + API client for the gwave item/points economy.

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY: Record<
  Rarity,
  { label: string; color: string; glow: string }
> = {
  common:    { label: "သာမန်",     color: "#9AA5A0", glow: "none" },
  uncommon:  { label: "ရှားပါး",    color: "#4CAF6D", glow: "0 0 14px rgba(76,175,109,.35)" },
  rare:      { label: "အလွန်ရှား",  color: "#3B82F6", glow: "0 0 14px rgba(59,130,246,.40)" },
  epic:      { label: "ထူးခြား",    color: "#A855F7", glow: "0 0 16px rgba(168,85,247,.45)" },
  legendary: { label: "ဒဏ္ဍာရီ",   color: "#F5B437", glow: "0 0 20px rgba(245,180,55,.55)" },
};

export interface ShopItem {
  id: string;
  sku: string;
  name: string;
  name_my: string | null;
  category: string;
  rarity: Rarity;
  thumbnail_url: string | null;
  price_points: number;
  max_supply: number | null;
  minted_count: number;
}

export interface InventoryItem {
  id: string; // user_item id
  serial_no: number | null;
  equipped: boolean;
  locked: boolean;
  acquired_via: string;
  sku: string;
  name: string;
  name_my: string | null;
  category: string;
  rarity: Rarity;
  asset_url: string | null;
  thumbnail_url: string | null;
}

export const CATEGORY_MY: Record<string, string> = {
  avatar_skin: "Avatar Skin",
  avatar_body: "ကိုယ်ခန္ဓာ",
  weapon_skin: "လက်နက် Skin",
  emote: "Emote",
  badge: "တံဆိပ်",
  room_decor: "အခန်းအလှ",
  consumable: "သုံးပစ္စည်း",
  other: "အခြား",
};

// Postgres exception -> Burmese user message
const ERROR_MY: Record<string, string> = {
  INSUFFICIENT_POINTS: "Points မလုံလောက်ပါ",
  SOLD_OUT: "ပစ္စည်းကုန်သွားပါပြီ",
  NOT_FOR_SALE: "ဒီပစ္စည်းက ရောင်းချထားတာ မဟုတ်ပါ",
  NOT_OWNED_OR_LOCKED: "ဒီပစ္စည်းကို သုံးလို့မရသေးပါ (lock ဖြစ်နေသည်)",
  ALREADY_CLAIMED: "ဒီနေ့အတွက် ဆုယူပြီးသားပါ",
  CANNOT_LIST: "ဒီပစ္စည်းကို ရောင်းစာရင်းတင်လို့မရပါ",
  LISTING_UNAVAILABLE: "ဒီရောင်းစာရင်းက မရနိုင်တော့ပါ",
  CANNOT_BUY_OWN: "ကိုယ့်ပစ္စည်းကိုယ် ပြန်ဝယ်လို့မရပါ",
  UNAUTHORIZED: "အကောင့်ဝင်ရန် လိုအပ်ပါသည်",
};

export function errMy(code: string): string {
  for (const key of Object.keys(ERROR_MY)) {
    if (code.includes(key)) return ERROR_MY[key] ?? code;
  }
  return "တစ်ခုခုမှားယွင်းနေပါသည် — ထပ်စမ်းကြည့်ပါ";
}

async function api<T>(
  path: string,
  init?: RequestInit & { idempotent?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (init?.idempotent) headers["Idempotency-Key"] = crypto.randomUUID();

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "UNKNOWN");
  return data as T;
}

export const economyApi = {
  shopItems: () => api<ShopItem[]>("/api/economy/items"),
  buy: (itemId: string) =>
    api<{ ok: true; userItemId: string }>("/api/economy/buy", {
      method: "POST",
      body: JSON.stringify({ itemId }),
      idempotent: true,
    }),
  inventory: () => api<InventoryItem[]>("/api/economy/inventory"),
  equip: (userItemId: string) =>
    api<{ ok: true }>("/api/economy/equip", {
      method: "POST",
      body: JSON.stringify({ userItemId }),
    }),
  points: () =>
    api<{ balance: number; history: unknown[] }>("/api/economy/points"),
  claim: (code: string) =>
    api<{ ok: true; balance: number }>("/api/economy/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  listForSale: (userItemId: string, pricePoints: number) =>
    api<{ ok: true; listingId: string }>("/api/economy/list", {
      method: "POST",
      body: JSON.stringify({ userItemId, pricePoints }),
    }),
};
