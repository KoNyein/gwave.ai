/// Metaverse WebSocket client.
///
/// ★ ဒီ layer ရဲ့ အဓိကတာဝန် ၂ ခု:
///   1. **ဘယ်တော့မှ လက်လျှော့မထွက်** — server restart, WiFi→data ပြောင်း,
///      terminal ခဏပိတ် — အားလုံးမှာ exponential backoff နဲ့ ပြန်ချိတ်တယ်။
///      ချိတ်မရသေးတဲ့အချိန်မှာ 3D လောကက ဆက်လည်နေရမယ် (single-player)။
///   2. **ပို့တာကို ချုပ်** — position ကို frame တိုင်း (60Hz) ပို့ရင် bandwidth
///      ၄ ဆ ကုန်ပြီး ဖုန်း data plan ကို စားမယ်။ 15Hz + မပြောင်းရင် မပို့။

export type RemoteState = {
  x: number;
  y: number;
  z: number;
  ry: number;
  name?: string;
  emote?: string | null;
};

export type NetHandlers = {
  onInit?: (p: {
    id: string;
    room: string;
    name: string;
    authed: boolean;
    serverTime: number;
    players: Record<string, RemoteState>;
  }) => void;
  onJoin?: (id: string, state: RemoteState) => void;
  onLeave?: (id: string) => void;
  onUpdate?: (id: string, x: number, y: number, z: number, ry: number) => void;
  onEmote?: (id: string, emote: string | null) => void;
  onChat?: (id: string, name: string, text: string) => void;
  onName?: (id: string, name: string) => void;
  /// Server က anti-cheat နဲ့ ငြင်းလိုက်တဲ့အခါ — နေရာအမှန်ကို ပြန်ပေးတယ်
  onCorrect?: (x: number, y: number, z: number) => void;
  onStatus?: (connected: boolean, detail?: string) => void;
};

export type NetClient = {
  sendUpdate(x: number, y: number, z: number, ry: number): void;
  sendChat(text: string): void;
  sendEmote(emote: string | null): void;
  close(): void;
  readonly connected: boolean;
};

const SEND_HZ = 15;
const SEND_GAP_MS = 1000 / SEND_HZ;
const MAX_BACKOFF_MS = 15_000;

/// Ticket ယူတယ် — မရရင် null ပြန်ပြီး guest အဖြစ် ဆက်ချိတ်တယ်။
/// (Phase 3 မှာ server က REQUIRE_AUTH=true ဖြစ်သွားရင် guest ကို ငြင်းမယ်၊
/// အဲဒီအခါ onStatus က "auth required" ကို ပြောပြမယ်။)
async function fetchTicket(): Promise<string | null> {
  try {
    const res = await fetch("/api/metaverse/ws-ticket", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ticket?: string };
    return json.ticket ?? null;
  } catch {
    return null;
  }
}

export function connectMetaverse(
  url: string,
  room: string,
  handlers: NetHandlers,
): NetClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  let lastSentAt = 0;
  const lastSent = { x: NaN, y: NaN, z: NaN, ry: NaN };

  const client: NetClient = {
    get connected() {
      return ws?.readyState === WebSocket.OPEN;
    },
    sendUpdate(x, y, z, ry) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (now - lastSentAt < SEND_GAP_MS) return;
      // ★ ငြိမ်နေရင် မပို့ — ရပ်နေတဲ့ player ၁၀၀ က တစ်စက္ကန့် packet ၁၅၀၀
      // ပို့နေစရာမလိုဘူး။
      if (
        Math.abs(x - lastSent.x) < 0.01 &&
        Math.abs(y - lastSent.y) < 0.01 &&
        Math.abs(z - lastSent.z) < 0.01 &&
        Math.abs(ry - lastSent.ry) < 0.01
      ) {
        return;
      }
      lastSentAt = now;
      lastSent.x = x;
      lastSent.y = y;
      lastSent.z = z;
      lastSent.ry = ry;
      ws.send(JSON.stringify({ type: "update", x, y, z, ry }));
    },
    sendChat(text) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const t = text.slice(0, 200).trim();
      if (!t) return;
      ws.send(JSON.stringify({ type: "chat", text: t }));
    },
    sendEmote(emote) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "emote", emote }));
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close(1000, "leaving");
      ws = null;
    },
  };

  const scheduleRetry = (detail: string) => {
    if (closed) return;
    handlers.onStatus?.(false, detail);
    // 1s, 2s, 4s, 8s, 15s… + jitter (server ပြန်တက်တဲ့အခါ client အားလုံး
    // တစ်ပြိုင်နက် ဝင်လာပြီး ထပ်ချရင် အဓိပ္ပာယ်မရှိဘူး)
    const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) * (0.7 + Math.random() * 0.6);
    attempt++;
    retryTimer = setTimeout(open, wait);
  };

  async function open() {
    if (closed) return;
    const ticket = await fetchTicket();
    if (closed) return;

    const qs = new URLSearchParams({ room });
    if (ticket) qs.set("ticket", ticket);

    let socket: WebSocket;
    try {
      socket = new WebSocket(`${url}?${qs.toString()}`);
    } catch {
      scheduleRetry("bad url");
      return;
    }
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      handlers.onStatus?.(true);
    };

    socket.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (m.type) {
        case "init":
          handlers.onInit?.({
            id: String(m.id),
            room: String(m.room),
            name: String(m.name ?? "Guest"),
            authed: Boolean(m.authed),
            serverTime: Number(m.serverTime) || Date.now(),
            players: (m.players as Record<string, RemoteState>) ?? {},
          });
          break;
        case "join":
          handlers.onJoin?.(String(m.id), m.state as RemoteState);
          break;
        case "leave":
          handlers.onLeave?.(String(m.id));
          break;
        case "update":
          handlers.onUpdate?.(
            String(m.id),
            Number(m.x),
            Number(m.y),
            Number(m.z),
            Number(m.ry),
          );
          break;
        case "emote":
          handlers.onEmote?.(String(m.id), (m.emote as string | null) ?? null);
          break;
        case "chat":
          handlers.onChat?.(String(m.id), String(m.name), String(m.text));
          break;
        case "name":
          handlers.onName?.(String(m.id), String(m.name));
          break;
        case "correct":
          handlers.onCorrect?.(Number(m.x), Number(m.y), Number(m.z));
          break;
        default:
          break;
      }
    };

    socket.onclose = (ev) => {
      ws = null;
      if (closed) return;
      // 4001 = auth လိုတယ်။ ဒါက ပြန်ချိတ်လို့ ဖြေရှင်းလို့မရတဲ့ အမှား —
      // ဆက်ချိတ်နေရင် server ကို အလကား ရိုက်နေတာပဲ ဖြစ်မယ်။
      if (ev.code === 4001) {
        handlers.onStatus?.(false, "auth");
        closed = true;
        return;
      }
      scheduleRetry(ev.code === 1001 ? "restarting" : "disconnected");
    };

    socket.onerror = () => {
      // onclose က နောက်ကနေ လိုက်လာမှာမို့ ဒီမှာ retry မလုပ်ဘူး —
      // မဟုတ်ရင် တစ်ခါပြတ်တာကို ၂ ခါ retry လုပ်မိမယ်။
    };
  }

  void open();
  return client;
}
