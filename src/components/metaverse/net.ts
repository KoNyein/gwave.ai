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
  /// ★ Gwave အကောင့်နဲ့ ဝင်ထားသူလား ဆိုတာ **server ကနေသာ** လာတယ်။
  /// နာမည်ကို ကြည့်ပြီး ခန့်မှန်းလို့ မရဘူး — ဧည့်သည်က ဘယ်နာမည်မဆို
  /// ပေးလို့ရလို့။
  authed?: boolean;
};

/// ── Mini-game (Phase 16) ────────────────────────────────────────────────────
/// ★ Client မှာ **အမှတ်မတွက်ဘူး** — server ကနေ လာတာကို ပြရုံပဲ။ ဒါကြောင့်
///   ဒီ type တွေထဲမှာ "ငါ့အမှတ်" ဆိုတာ မရှိဘူး၊ `scores` ပဲ ရှိတယ်။
export type GameInfo = {
  id: string;
  nameMy: string;
  minPlayers: number;
  maxPlayers: number;
  durationSec: number;
  arena: { x: number; z: number; radius: number };
};

export type GameObjective = {
  kind: "checkpoint" | "item" | "target" | "plant";
  x: number;
  z: number;
  index?: number;
  grown?: number;
};

export type GameScore = { id: string; name: string; score: number };
export type GameRanking = { playerId: string; name: string; score: number; rank: number };

export type NetHandlers = {
  onInit?: (p: {
    id: string;
    room: string;
    name: string;
    authed: boolean;
    serverTime: number;
    games: GameInfo[];
    players: Record<string, RemoteState>;
  }) => void;
  onJoin?: (id: string, state: RemoteState) => void;
  onLeave?: (id: string) => void;
  onUpdate?: (id: string, x: number, y: number, z: number, ry: number) => void;
  onEmote?: (id: string, emote: string | null) => void;
  onChat?: (id: string, name: string, text: string, authed: boolean) => void;
  onName?: (id: string, name: string) => void;
  /// Server က anti-cheat နဲ့ ငြင်းလိုက်တဲ့အခါ — နေရာအမှန်ကို ပြန်ပေးတယ်
  onCorrect?: (x: number, y: number, z: number) => void;
  onStatus?: (connected: boolean, detail?: string) => void;
  /// ★ ရာသီဥတုက **server ကနေသာ** လာတယ် — client မှာ ကျပန်းလုပ်ရင်
  /// ဘေးချင်းကပ်နေတဲ့ ၂ ယောက် မတူတဲ့ မိုးလေဝသထဲ ရောက်နေမယ်။
  onWeather?: (kind: string, intensity: number, windX: number, windZ: number) => void;
  onVehicle?: (id: string, x: number, y: number, z: number, ry: number, speed: number) => void;
  onMounted?: (vehicleId: string, playerId: string) => void;
  onDismounted?: (vehicleId: string, playerId: string) => void;
  onGameInvite?: (p: {
    gameId: string;
    nameMy: string;
    arena: { x: number; z: number; radius: number };
    startsIn: number;
    joined: string[];
  }) => void;
  onGameStart?: (p: {
    instanceId: string;
    gameId: string;
    nameMy: string;
    arena: { x: number; z: number; radius: number };
    players: string[];
    durationSec: number;
  }) => void;
  /// ★ Room တစ်ခုလုံးဆီ ရောက်တယ် — မကစားသူတွေလည်း ဘေးကနေ ကြည့်လို့ရရမယ်
  onGameState?: (p: { timeLeft: number; scores: GameScore[] }) => void;
  /// ★ ကစားသူဆီပဲ ရောက်တယ် — ရှာဖွေပွဲရဲ့ ပစ္စည်းနေရာက ဝှက်ထားရမယ့်အရာ
  onGameObjectives?: (objectives: GameObjective[]) => void;
  onGameEnd?: (p: {
    gameId: string;
    rankings: GameRanking[];
    rewards: { playerId: string; sku: string }[];
  }) => void;
  onGameCancelled?: (reason: string) => void;
  onGameJoinResult?: (gameId: string, status: string) => void;
  // ── Voice (Phase 14) ──────────────────────────────────────────────────────
  /// Voice ထဲရှိသူစာရင်း — client က ဒါနဲ့ WebRTC mesh ဆောက်တယ်
  onVoicePeers?: (peers: { id: string; muted: boolean }[]) => void;
  /// SDP/ICE relay — voice member အချင်းချင်းသာ
  onVoiceSignal?: (from: string, data: unknown) => void;
  onVoiceState?: (id: string, muted: boolean) => void;
  onVoiceLeft?: (id: string) => void;
  /// "age" = ၁၈+ မပြည့်/အသက်မသိ · "auth" = ဝင်မထား · "full" = ပြည့်နေပြီ
  onVoiceDenied?: (reason: string) => void;
};

export type NetClient = {
  sendUpdate(x: number, y: number, z: number, ry: number): void;
  sendChat(text: string): void;
  sendEmote(emote: string | null): void;
  /// Guest သာ — signed-in user ရဲ့ နာမည်က token ကလာလို့ server က ငြင်းတယ်။
  sendName(name: string): void;
  sendMount(vehicleId: string): void;
  sendDismount(): void;
  /// ★ "ငါဝင်မယ်" ပဲ ပြောလို့ရတယ် — အမှတ်တွက်တာ server မှာ (spec 16.3)。
  sendGameJoin(gameId: string): void;
  /// Tab/app က နောက်ပိုင်းရောက်သွားပြီ — server က position update တွေ
  /// ပို့မနေတော့ဘူး (ဖုန်း data + ဘက်ထရီ ချွေတယ်)。
  sendAfk(afk: boolean): void;
  sendVoiceJoin(): void;
  sendVoiceLeave(): void;
  sendVoiceMute(muted: boolean): void;
  sendVoiceSignal(to: string, data: unknown): void;
  /// ★ `action` က လုပ်ဆောင်ချက်သာ (ပစ်တယ်/စိုက်တယ်)。 ရလဒ်ကို server က
  /// ဆုံးဖြတ်တယ် — score ပါပို့လည်း ဘယ်နေရာမှာမှ မဖတ်ဘူး။
  sendGameAction(action: Record<string, unknown>): void;
  /// ★ Driver ရဲ့ client က ယာဉ်ရဲ့ နေရာကို တွက်ပြီး ပို့တယ် (authority)。
  /// Server က relay + speed cap ပဲ လုပ်တယ် — latency အနည်းဆုံးဖြစ်စေဖို့။
  sendVehicleState(
    vehicleId: string,
    s: { x: number; y: number; z: number; ry: number; speed: number },
  ): void;
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
  let lastVehicleAt = 0;
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
    sendName(name) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const n = name.slice(0, 24).trim();
      if (!n) return;
      ws.send(JSON.stringify({ type: "setname", name: n }));
    },
    sendMount(vehicleId) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "mount", vehicleId }));
    },
    sendDismount() {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "dismount" }));
    },
    sendGameJoin(gameId) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "gameJoin", gameId }));
    },
    sendAfk(afk) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "afk", afk }));
    },
    sendVoiceJoin() {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "voiceJoin" }));
    },
    sendVoiceLeave() {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "voiceLeave" }));
    },
    sendVoiceMute(muted) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "voiceMute", muted }));
    },
    sendVoiceSignal(to, data) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "voiceSignal", to, data }));
    },
    sendGameAction(action) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "gameAction", action }));
    },
    sendVehicleState(vehicleId, st) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      // ★ 15Hz — player ရဲ့ position နဲ့ တူညီတဲ့ နှုန်း
      if (now - lastVehicleAt < SEND_GAP_MS) return;
      lastVehicleAt = now;
      ws.send(
        JSON.stringify({
          type: "vstate",
          vehicleId,
          x: st.x,
          y: st.y,
          z: st.z,
          ry: st.ry,
          speed: st.speed,
        }),
      );
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
            games: Array.isArray(m.games) ? (m.games as GameInfo[]) : [],
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
          // ရိုးရိုး တစ်ယောက်စာ — rolling deploy အတွင်း task အဟောင်းက
          // ဒီပုံစံနဲ့ ပို့နေဆဲ ဖြစ်နိုင်လို့ ဆက်ထားတယ်
          handlers.onUpdate?.(
            String(m.id),
            Number(m.x),
            Number(m.y),
            Number(m.z),
            Number(m.ry),
          );
          break;
        case "updates": {
          // ★ စုပို့တဲ့ပုံစံ — `[id, x, y, z, ry]` array တွေ။ key နာမည်တွေ
          // ထည့်ရင် player ၂၀၀ စာ packet က ၂ ဆ ကြီးမယ်။
          const list = m.p as unknown[];
          if (!Array.isArray(list)) break;
          for (const e of list) {
            if (!Array.isArray(e) || e.length < 5) continue;
            handlers.onUpdate?.(
              String(e[0]),
              Number(e[1]),
              Number(e[2]),
              Number(e[3]),
              Number(e[4]),
            );
          }
          break;
        }
        case "emote":
          handlers.onEmote?.(String(m.id), (m.emote as string | null) ?? null);
          break;
        case "chat":
          handlers.onChat?.(
            String(m.id),
            String(m.name),
            String(m.text),
            Boolean(m.authed),
          );
          break;
        case "name":
          handlers.onName?.(String(m.id), String(m.name));
          break;
        case "weather":
          handlers.onWeather?.(
            String(m.kind ?? "clear"),
            Number(m.intensity ?? 1),
            Number(m.windX ?? 0),
            Number(m.windZ ?? 0),
          );
          break;
        case "vstate":
          handlers.onVehicle?.(
            String(m.vehicleId),
            Number(m.x),
            Number(m.y),
            Number(m.z),
            Number(m.ry),
            Number(m.speed),
          );
          break;
        case "mounted":
          handlers.onMounted?.(String(m.vehicleId), String(m.playerId));
          break;
        case "dismounted":
          handlers.onDismounted?.(String(m.vehicleId), String(m.playerId));
          break;
        case "correct":
          handlers.onCorrect?.(Number(m.x), Number(m.y), Number(m.z));
          break;
        case "gameInvite":
          handlers.onGameInvite?.({
            gameId: String(m.gameId),
            nameMy: String(m.nameMy ?? ""),
            arena: m.arena as { x: number; z: number; radius: number },
            startsIn: Number(m.startsIn) || 0,
            joined: Array.isArray(m.joined) ? (m.joined as string[]) : [],
          });
          break;
        case "gameStart":
          handlers.onGameStart?.({
            instanceId: String(m.instanceId),
            gameId: String(m.gameId),
            nameMy: String(m.nameMy ?? ""),
            arena: m.arena as { x: number; z: number; radius: number },
            players: Array.isArray(m.players) ? (m.players as string[]) : [],
            durationSec: Number(m.durationSec) || 0,
          });
          break;
        case "gameState":
          handlers.onGameState?.({
            timeLeft: Number(m.timeLeft) || 0,
            scores: Array.isArray(m.scores) ? (m.scores as GameScore[]) : [],
          });
          break;
        case "gameObjectives":
          handlers.onGameObjectives?.(
            Array.isArray(m.objectives) ? (m.objectives as GameObjective[]) : [],
          );
          break;
        case "gameEnd":
          handlers.onGameEnd?.({
            gameId: String(m.gameId),
            rankings: Array.isArray(m.rankings) ? (m.rankings as GameRanking[]) : [],
            rewards: Array.isArray(m.rewards)
              ? (m.rewards as { playerId: string; sku: string }[])
              : [],
          });
          break;
        case "gameCancelled":
          handlers.onGameCancelled?.(String(m.reason ?? ""));
          break;
        case "gameJoinResult":
          handlers.onGameJoinResult?.(String(m.gameId), String(m.status));
          break;
        case "voicePeers":
          handlers.onVoicePeers?.(
            Array.isArray(m.peers) ? (m.peers as { id: string; muted: boolean }[]) : [],
          );
          break;
        case "voiceSignal":
          handlers.onVoiceSignal?.(String(m.from), m.data);
          break;
        case "voiceState":
          handlers.onVoiceState?.(String(m.id), Boolean(m.muted));
          break;
        case "voiceLeft":
          handlers.onVoiceLeft?.(String(m.id));
          break;
        case "voiceDenied":
          handlers.onVoiceDenied?.(String(m.reason));
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
