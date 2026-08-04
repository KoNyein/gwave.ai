"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createSpatialAudio, type SpatialAudio } from "./audio";
import { AvatarCustomiser } from "./avatar/customiser";
import { BrandedLoading } from "./branded-loading";
import { HudMenu } from "./hud-menu";
import { DEFAULT_AVATAR, sanitizeAvatar, type AvatarConfig } from "./avatar/config";
import { applyAvatarConfig } from "./avatar/parts";
import { BuildPanel, type BuildBridge } from "./build/panel";
import { createPlotStream } from "./build/plots";
import { createBuildRender, createGhost } from "./build/render";
import { createSfx, type Sfx } from "../games/assassin/sfx";
import { createCombatFx, type CombatFx } from "./combatfx";
import { createGameFx, type GameFx } from "./gamefx";
import { GamesMenu, GamesOverlays, type GamePhase } from "./games-panel";
import { createHuman, type Avatar, type HumanState } from "./human";
import { buildLandmarks, type Landmark } from "./landmarks";
import { attachLiveScreen, type LiveScreen } from "./livescreen";
import { getMap, MAP_LIST } from "./maps";
import { createMinimap } from "./minimap";
import { createNametags } from "./nametags";
import {
  connectMetaverse,
  type GameInfo,
  type NetClient,
  type RemoteState,
} from "./net";
import { createPostFx } from "./postfx";
import { createQuality } from "./quality";
import { createVehicle, type Vehicle } from "./vehicles";
import { VoicePanel } from "./voice-panel";
import { createVoiceChat, type VoiceChat } from "./voicechat";
import { createWeather } from "./weather";
import { OwnershipControl } from "./web3/ownership";
import { buildWorld, resolveCollision } from "./world";
import { isInApp, native } from "@/lib/metaverse/native";
import { snap, type BuildType } from "@/lib/metaverse/build";
import { questEvent } from "@/lib/quests";

/// Gwave Metaverse ရဲ့ အဓိက client component။
///
/// ★ စည်းမျဉ်း ၂ ခု — ဒီ ၂ ခုက performance ရဲ့ အခြေခံ:
///   1. Player ရဲ့ နေရာ/လှည့်ထောင့်ကို React state ထဲ **လုံးဝမထား** —
///      60fps မှာ setState ခေါ်ရင် တစ်စက္ကန့် re-render ၆၀ ခါဖြစ်ပြီး
///      ဖုန်းက ပူလာမယ်။ ref နဲ့ mutable object ထဲမှာသာထားတယ်။
///   2. useEffect ရဲ့ cleanup က renderer, geometry, material, RAF, listener
///      အားလုံးကို ပြန်ရှင်းရမယ် — page ကူးတိုင်း WebGL context တစ်ခုစီ
///      ကျန်ခဲ့ရင် browser က ~16 ခုပြည့်တာနဲ့ context အဟောင်းတွေ ဖျက်ပစ်တယ်။

const EMOTES = [
  { key: "wave" as const, icon: "👋", label: "နှုတ်ဆက်" },
  { key: "dance" as const, icon: "🕺", label: "ကခုန်" },
  { key: "sit" as const, icon: "🪑", label: "ထိုင်" },
];

/// နေ့တစ်ရက် = ၃ မိနစ် (spec)။
const DAY_SECONDS = 180;

/// WS URL မရှိရင် networking လုံးဝမလုပ်ဘူး — လောကက single-player အဖြစ်
/// ပုံမှန်ဖွင့်ရမယ်။ (Progressive: server ကျနေရင်လည်း အတူတူပဲ။)
const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";

/// Multiplayer server ရဲ့ candidate URL များ။
/// ★ Env override (build-time) အရင်၊ ပြီးရင် **same-origin `/mv/ws`** —
///   main domain (gwave.cc) ရဲ့ Caddy က metaverse container ကို ဖြတ်ပေးတယ်။
///   ဒီနည်းနဲ့ DNS record အသစ်ရော build-time variable ရော **မလိုတော့ဘူး** —
///   တစ်ခုခု ပျက်နေရင်တောင် retry တိုင်း နောက် candidate ကို လှည့်စမ်းတယ်။
/// ★ https မှသာ same-origin ကို ထည့်တယ် — localhost dev (http) မှာ server
///   မရှိဘဲ အလကား retry မလုပ်စေချင်လို့ (env နဲ့ အတိအကျ ညွှန်လို့ရတယ်)။
function wsCandidates(): string[] {
  const out: string[] = [];
  if (WS_URL) out.push(WS_URL);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const sameOrigin = `wss://${window.location.host}/mv/ws`;
    if (!out.includes(sameOrigin)) out.push(sameOrigin);
  }
  return out;
}
const DEFAULT_ROOM = process.env.NEXT_PUBLIC_MV_ROOM || "city";

/// ရွေးထားတဲ့ map ကို မှတ်ထားတယ် — ဝင်တိုင်း မြို့ကနေ ပြန်စရရင်
/// နှစ်သက်ရာ map ရှိသူအတွက် အနှောင့်အယှက်။
const MAP_KEY = "gw.mv.map";
/// မြို့လယ် မျက်နှာပြင်ရဲ့ default stream။ တကယ် live ရှိရင် board API က
/// အဲဒါကို ကျော်ပြီး အသုံးပြုတယ်။
const IVS_URL = process.env.NEXT_PUBLIC_IVS_PLAYBACK_URL || "";

/// Bloom ကို ဖုန်းအဟောင်းမှာ ပိတ်ထားလို့ရအောင် — ရွေးချယ်မှုက localStorage
/// မှာ ကျန်ရမယ်၊ ဝင်တိုင်း ပြန်ပိတ်နေရရင် အသုံးမဝင်ဘူး။
const BLOOM_KEY = "gw.mv.bloom";
const SHADOW_KEY = "gw.mv.shadows";

/// Animation LOD / visibility cull ရဲ့ အကွာအဝေး (spec 6.1)။
/// ★ ဝေးတဲ့သူတွေရဲ့ **နေရာကိုတော့ ဆက်တွက်တယ်** — animation ကိုပဲ ရပ်တာ။
/// နေရာပါ ရပ်လိုက်ရင် အနားရောက်လာချိန်မှာ ရုတ်တရက် နေရာသစ်ဆီ ခုန်သွားမယ်။
const LOD_ANIMATE_WITHIN = 45;
const CULL_BEYOND = 90;

/// Player id ကနေ အဝတ်အရောင် — တစ်ယောက်နဲ့တစ်ယောက် ခွဲမြင်ရဖို့။
/// Server ကနေ အရောင်မပို့ဘဲ id ကနေ တွက်တာက packet မလိုဘဲ တည်ငြိမ်တယ်
/// (client တိုင်းမှာ id တူရင် အရောင်တူတယ်)။
const CLOTH_COLORS = [
  0xe94f37, 0x3f88c5, 0xf6ae2d, 0x44bba4, 0xa06cd5, 0xff8c42, 0x6cc551,
];
function colorFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CLOTH_COLORS[h % CLOTH_COLORS.length] ?? 0x44bba4;
}

type Remote = {
  avatar: Avatar;
  /// မျက်နှာပြင်မှာ ပြနေတဲ့ နေရာ (ချောချောလိုက်တယ်)
  cur: { x: number; y: number; z: number; ry: number };
  /// Server ကနေ နောက်ဆုံးရလာတဲ့ နေရာ
  target: { x: number; y: number; z: number; ry: number };
  name: string;
  emote: HumanState["emote"];
  speed: number;
};

type ChatLine = {
  id: string;
  name: string;
  text: string;
  at: number;
  /// Gwave account နဲ့ ဝင်ထားသူလား၊ ဧည့်သည်လား — နာမည်ကို ကြည့်ပြီး
  /// ခွဲလို့မရဘူး၊ ဧည့်သည်က ဘယ်နာမည်မဆို ပေးလို့ရလို့။
  authed: boolean;
};

/// ★ CS-style — **default က ပြေးတာ** (7.5)၊ Shift က လမ်းလျှောက် (နှေး)၊
/// Ctrl က ကုပ်။ အရင်က default 4.2 နဲ့ လမ်းလျှောက်ရတာ နှေးလွန်းတယ်လို့
/// user တွေ ညည်းတယ်။
const WALK_SPEED = 3.4;
const RUN_SPEED = 7.5;
const CROUCH_SPEED = 2.6;
const JUMP_V = 6.2;
const GRAVITY = 18;

type Input = {
  f: number; // ရှေ့
  b: number; // နောက်
  l: number;
  r: number;
  /// Shift — CS လိုပဲ ဖိထားရင် **နှေးနှေး** လျှောက်တယ် (ယာဉ်မှာတော့ boost)
  run: boolean;
  /// Ctrl — ကုပ် (နှေး + နိမ့်)
  crouch: boolean;
  jump: boolean;
  /// Mobile joystick — -1..1
  jx: number;
  jz: number;
};

export function MetaverseScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  /// ★ ဖုန်းလား desktop လား ကို **screen width နဲ့ မခွဲရ** — အလျားလိုက်ကိုင်တဲ့
  /// ဖုန်းက width ကျယ်လို့ desktop လို့ ထင်ပြီး joystick ပျောက်သွားတယ်
  /// (အလျားလိုက် ဆော့လို့မရတဲ့ bug)။ Touch ရှိမရှိနဲ့သာ ခွဲတယ်။
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(
      window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0,
    );
  }, []);
  const [fps, setFps] = useState(0);
  const [emote, setEmote] = useState<HumanState["emote"]>(null);
  const [bloom, setBloom] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [sound, setSound] = useState(false);
  /// ★ First-person မြင်ကွင်း — ခလုတ် (👁) / V key / zoom အဆုံးထိ ဆွဲရင်
  /// ဝင်တယ်။ Render loop က frame တိုင်း ဖတ်လို့ ref နဲ့ တွဲထားတယ်
  /// (bloomRef ပုံစံအတိုင်း — state က ခလုတ် UI အတွက်ပဲ)။
  const [fpv, setFpv] = useState(false);
  const fpvRef = useRef(false);
  /// HUD ခလုတ်ကနေ effect ထဲက setFpView ကို ခေါ်ဖို့ (cam.dist ကိုပါ
  /// ပြင်ရလို့ effect ထဲမှာပဲ ကြေညာလို့ရတယ်)
  const fpvSetRef = useRef<((on: boolean) => void) | null>(null);
  /// စက်နှေးလို့ အလိုအလျောက် လျှော့ချထားလား
  const [degraded, setDegraded] = useState(false);
  /// Web3 — **ဖြည့်စွက်အလွှာသာ**။ wallet မချိတ်ဘဲ လောကက အပြည့်အဝ
  /// အလုပ်လုပ်ရမယ် (spec 7 ရဲ့ စည်းမျဉ်း ၄)။
  const [wallet, setWallet] = useState<string | null>(null);
  /// လောကထဲက နာရီ — HUD မှာ ပြဖို့ (player အားလုံး တူညီရမယ်)
  const [clock, setClock] = useState("");
  const [nearby, setNearby] = useState<Landmark | null>(null);
  /// ★ Map ပြောင်းရင် scene တစ်ခုလုံး ပြန်ဆောက်တယ် (effect ရဲ့ dependency)
  /// — map တစ်ခုချင်းက သီးခြားလောက ဖြစ်လို့ ကြားခံ state ကျန်ခဲ့လို့မရဘူး။
  const [roomId, setRoomId] = useState(DEFAULT_ROOM);
  /// ဘယ်ဘက်တန်း (accordion) မှာ ဖွင့်ထားတဲ့ panel — တစ်ခုတည်းသာ
  /// တစ်ပြိုင်နက် ပွင့်တယ်၊ ဒါမှ panel ချင်း ဘယ်တော့မှ မထပ်ဘူး။
  const [menu, setMenu] = useState<"map" | "games" | "voice" | "settings" | null>(null);
  const [dressing, setDressing] = useState(false);
  /// ★ Avatar ပြင်ပြီးရင် scene ကို ပြန်ဆောက်တယ် — ရိုးရှင်းပြီး
  /// မှားနိုင်ခြေနည်းတယ် (attachment တွေ တစ်ခုချင်း sync လုပ်တာထက်)。
  const [avatarNonce, setAvatarNonce] = useState(0);
  /// စီးလို့ရတဲ့ ယာဉ် အနားမှာ ရှိလား / စီးနေလား
  const [ride, setRide] = useState<{ label: string; riding: boolean } | null>(null);
  const rideRef = useRef<(() => void) | null>(null);
  const tagsRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<SpatialAudio | null>(null);
  const bloomRef = useRef(true);
  const shadowRef = useRef<((on: boolean) => void) | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  /// အလိုအလျောက် လျှော့ချထားရင် bloom ကို ဖွင့်ခွင့်မပြုဘူး — ဒါပေမယ့်
  /// လူရဲ့ ရွေးချယ်မှု (localStorage) ကို မဖျက်ဘူး၊ စက်ကောင်းတဲ့ဖုန်းနဲ့
  /// နောက်တစ်ခါဝင်ရင် ပြန်ရမယ်။
  const degradedRef = useRef(false);
  // ဒီ ၃ ခုက မကြာခဏမပြောင်းလို့ React state နဲ့ ရတယ် (position မဟုတ်ဘူး)
  const [online, setOnline] = useState(1);
  // ssr:false မို့ ဒီ initializer က browser မှာပဲ ပြေးတယ် — window သုံးလို့ရတယ်
  const [link, setLink] = useState<"off" | "connecting" | "live" | "auth">(() =>
    wsCandidates().length > 0 ? "connecting" : "off",
  );
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [meName, setMeName] = useState("");
  const [meAuthed, setMeAuthed] = useState(false);
  const netRef = useRef<NetClient | null>(null);

  // ── Mini-game (Phase 16) ─────────────────────────────────────────────────
  /// ★ Game state အားလုံးက **server ကနေ** လာတယ် — ဒီမှာက ပြဖို့ ကူးထားတာ။
  /// အမှတ်ကို client မှာ တွက်ရင် devtools ကနေ ပြင်လို့ရသွားမယ်။
  const [gameList, setGameList] = useState<GameInfo[]>([]);
  const [phase, setPhase] = useState<GamePhase>({ kind: "idle" });
  const [meId, setMeId] = useState("");
  /// ★ `shoot` က ဦးတည်ရာ (`ry`) လိုတယ် — အဲဒါက render loop ထဲက mutable
  /// object မှာ ရှိလို့ React state ကနေ ဖတ်လို့မရဘူး။ Effect ထဲကနေ
  /// function တစ်ခု ထုတ်ပေးထားတယ်။
  const gameActionRef = useRef<((a: Record<string, unknown>) => void) | null>(null);

  // ── ⚔️ Arena (hub-world game room) — combat HUD state ────────────────────
  // ★ Room type "game" (arena) မှာသာ သုံးတယ်။ Avatar/socket/login က social
  //   room တွေနဲ့ တစ်ခုတည်း — combat layer ကပဲ အထပ်ပိုတာ။
  type ArenaBoardRow = { id: string; name: string; score: number; alive: boolean };
  type ArenaYou = {
    hp: number;
    alive: boolean;
    kills: number;
    score: number;
    weapon: string;
    ammo: Record<string, number>;
    target: { id: string; name: string } | null;
  };
  const [arenaHud, setArenaHud] = useState<{
    weapons: Record<string, { my: string }>;
    you: ArenaYou | null;
    board: ArenaBoardRow[];
    feed: { text: string; good: boolean; at: number }[];
    denied: boolean;
  }>({ weapons: {}, you: null, board: [], feed: [], denied: false });
  const arenaFireRef = useRef<(() => void) | null>(null);
  /// ကျည်ဖြည့် / လက်နက်ပြောင်း — HUD ခလုတ်နဲ့ keyboard နှစ်ခုလုံးက ဒီကို
  /// ခေါ်တယ် (sfx ပါ တွဲဖွင့်ဖို့ effect ထဲမှာ သတ်မှတ်တယ်)
  const arenaReloadRef = useRef<(() => void) | null>(null);
  const arenaWeaponPickRef = useRef<((key: string) => void) | null>(null);
  /// 1-7 keyboard အတွက် — aInit ရောက်မှ ပြည့်တယ်
  const arenaWeaponListRef = useRef<string[]>([]);
  /// 🏆 အမှတ်စာရင်း — Tab ဖိထားစဉ် / 🏆 ခလုတ်နဲ့ ဖွင့်ပိတ်
  const [showBoard, setShowBoard] = useState(false);
  /// ထိမှန်မှု တုံ့ပြန်ချက် — crosshair ဘေး ✕ (200ms)
  const [hitMark, setHitMark] = useState<{ head: boolean; at: number } | null>(null);
  /// အထိခံရချိန် အနီရောင် vignette
  const [dmgOn, setDmgOn] = useState(false);
  /// အလယ်တည့်တည့် ကြေညာစာတန်း (kill / win / respawn)
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad"; at: number } | null>(null);
  /// 📣 ဖိတ်စာ ကူးပြီးကြောင်း အတည်ပြုချက်
  const [invited, setInvited] = useState(false);
  /// 🎯 ADS (ချိန်ကွင်းချိန်ခြင်း) — right-click ဖိထား / 🎯 ခလုတ် toggle။
  /// state က UI (scope overlay/ခလုတ်အရောင်)၊ ref က render loop (FOV zoom)။
  const [ads, setAds] = useState(false);
  const adsRef = useRef(false);
  const setAdsBoth = useCallback((on: boolean) => {
    adsRef.current = on;
    setAds(on);
  }, []);
  /// 🔫 ဖိထားရင် ဆက်ပစ် (auto-fire) — effect ထဲက fire loop ကို ချိတ်တယ်
  const arenaFireHoldRef = useRef<((down: boolean) => void) | null>(null);
  /// 🧎 ကုပ်ခလုတ် (ဖုန်း) — effect ထဲက input.crouch ကို တိုက်ရိုက်ထိတယ်
  const [crouchOn, setCrouchOn] = useState(false);
  const crouchSetRef = useRef<((on: boolean) => void) | null>(null);
  /// ထိမှန်မှု ဒဏ်ရာဂဏန်း (-34) — crosshair ဘေး ပေါ်ပြီး ပျောက်တယ်
  const [dmgNums, setDmgNums] = useState<{ id: number; text: string; head: boolean }[]>([]);
  /// အထိခံရတဲ့ ဦးတည်ရာ — မျက်နှာပြင်အလယ် အနီမြှား (PUBG-style)
  const [hurtFrom, setHurtFrom] = useState<{ deg: number; at: number } | null>(null);

  // ── 🙈 ဝှက်တမ်း (hub-world game room, hide-1) ────────────────────────────
  type HidePlayer = { id: string; name: string; score: number };
  const [hideHud, setHideHud] = useState<{
    phase: "waiting" | "countdown" | "live" | "ended";
    endsAt: number | null;
    role: "seeker" | "hider" | null;
    blindUntil: number | null;
    players: HidePlayer[];
    feed: { text: string; good: boolean; at: number }[];
  }>({ phase: "waiting", endsAt: null, role: null, blindUntil: null, players: [], feed: [] });
  const hideTagRef = useRef<(() => void) | null>(null);
  /// ပွဲချိန်တိုင်မာ / blind countdown — စက္ကန့်တိုင်း rerender ဖို့
  const [nowSec, setNowSec] = useState(() => Date.now());
  useEffect(() => {
    if (roomId !== "hide-1") return;
    const t = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(t);
  }, [roomId]);
  /// ★ Loading overlay — ပထမဆုံး "live" မဖြစ်မချင်း Gwave branding ပြတယ်။
  /// Room ပြောင်းတိုင်း ပြန်ပေါ်တယ် (world/game အဝင်တိုင်း)။
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    if (link === "live") setBooted(true);
  }, [link]);

  // ── ဆောက်လုပ်ရေး (Phase 18) ───────────────────────────────────────────────
  /// ★ Panel က React၊ ghost နဲ့ instance တွေက 3D — ကြားထဲမှာ ref တစ်ခုနဲ့
  /// ချိတ်တယ်။ Object စာရင်းကို React state ထဲ ထားပေမယ့် **ghost ရဲ့ နေရာ**
  /// က render loop ထဲမှာ frame တိုင်း ပြောင်းလို့ ref ကနေ ဖတ်ရတယ်။
  const [building, setBuilding] = useState(false);
  const buildRef = useRef<BuildBridge | null>(null);

  // ── Voice chat (Phase 14) ─────────────────────────────────────────────────
  /// "off" = မဝင်သေး · "on" = ဝင်ထား · "denied-*" = server က ငြင်းတယ်
  const [voiceState, setVoiceState] = useState<
    "off" | "joining" | "on" | "denied-age" | "denied-auth" | "denied-full"
  >("off");
  const [micOn, setMicOn] = useState(false);
  /// Voice ထဲရှိသူများ — mute/report ခလုတ်တွေ ပြဖို့
  const [voicePeers, setVoicePeers] = useState<{ id: string; muted: boolean }[]>([]);
  const [voiceMutes, setVoiceMutes] = useState<Set<string>>(new Set());
  const voiceRef = useRef<VoiceChat | null>(null);
  /// Voice panel မှာ ပြမယ့် နာမည် — remotes map က effect ထဲမှာ ရှိလို့
  /// lookup function ကို ref နဲ့ ထုတ်ပေးထားတယ်။
  const nameOfRef = useRef<(id: string) => string>(() => "Gwave");

  // Emote ကို ref နဲ့ ကူးထားတယ် — render loop က state ကို closure ထဲ
  // ဖမ်းထားလို့ တိုက်ရိုက်ဖတ်ရင် အဟောင်းပဲ ရမယ်။
  const emoteRef = useRef<HumanState["emote"]>(null);
  // နေ့စဉ် quest — လောကထဲ ဝင်တာကို မှတ်တယ် (Edu Arcade ရဲ့ quest panel မှာ ပြ)
  useEffect(() => {
    questEvent("mv_visit");
  }, []);

  useEffect(() => {
    emoteRef.current = emote;
    // တခြားသူတွေလည်း မြင်ရအောင် — emote က ငြိမ်နေမှ ပေါ်တာမို့ ဒါက
    // မကြာခဏ ပို့တဲ့ message မဟုတ်ဘူး။
    netRef.current?.sendEmote(emote);
  }, [emote]);

  // Bloom ရွေးချယ်မှုကို ပြန်ဖတ် — ဖုန်းအဟောင်းမှာ ပိတ်ထားသူက ဝင်တိုင်း
  // ပြန်ပိတ်နေရရင် အသုံးမဝင်ဘူး။
  useEffect(() => {
    // ★ App (WebView) ထဲမှာ bloom နဲ့ အရိပ်ကို default ပိတ်တယ် — ဒါ ၂ ခုက
    // ဖုန်းမှာ အကုန်ဆုံး ၂ ခု (spec 17.4)。 ခလုတ်တွေက ရှိနေဆဲမို့ ဖွင့်ချင်ရင်
    // ဖွင့်လို့ရတယ်။
    if (isInApp()) {
      setBloom(false);
      setShadows(false);
    }
    if (window.localStorage.getItem(BLOOM_KEY) === "0") setBloom(false);
    if (window.localStorage.getItem(SHADOW_KEY) === "0") setShadows(false);
    // ★ ?room= deep link (📣 ဖိတ်စာ link) က မှတ်ထားတဲ့ room ထက် အနိုင်ရ —
    //   သူငယ်ချင်း ပို့တဲ့ link နှိပ်ရင် သူ့ room ထဲ တန်းရောက်ရမယ်။
    const fromUrl = new URLSearchParams(window.location.search).get("room");
    const urlRoom = fromUrl && MAP_LIST.some((m) => m.id === fromUrl) ? fromUrl : null;
    const saved = urlRoom ?? window.localStorage.getItem(MAP_KEY);
    if (saved) setRoomId(saved);
  }, []);

  // render loop က ref ကနေ ဖတ်တယ် — state ကို closure ထဲ ဖမ်းထားလို့
  useEffect(() => {
    bloomRef.current = bloom;
    window.localStorage.setItem(BLOOM_KEY, bloom ? "1" : "0");
  }, [bloom]);

  useEffect(() => {
    window.localStorage.setItem(SHADOW_KEY, shadows ? "1" : "0");
    shadowRef.current?.(shadows);
  }, [shadows]);

  useEffect(() => {
    degradedRef.current = degraded;
  }, [degraded]);

  // ချိတ်ထားပြီးသားလား **server ကို မေးတယ်** — browser ထဲက wallet ကို
  // မမေးဘူး။ ★ Passkey နဲ့ ချိတ်ထားသူဆိုရင် ဒီ browser မှာ
  // `window.ethereum` မရှိလို့ `eth_accounts` က အမြဲ ဗလာ ပြန်ပေးမယ်၊
  // ပြီးတော့ ဖုန်းပြောင်းသုံးရင်လည်း အတူတူပဲ — အမှန်တရားက
  // `mv_players.wallet` မှာ ရှိတယ်။
  useEffect(() => {
    let alive = true;
    void fetch("/api/metaverse/siwe/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { wallet?: string | null } | null) => {
        if (alive && j?.wallet) setWallet(j.wallet);
      })
      .catch(() => {
        /* ★ ချိတ်ထားလားမသိတာက လောကကို မထိခိုက်ရ — chip က
           "ချိတ်ရန်" ပြနေရုံပဲ။ */
      });
    return () => {
      alive = false;
    };
  }, []);


  const chooseMap = (id: string) => {
    window.localStorage.setItem(MAP_KEY, id);
    setMenu(null);
    setRoomId(id);
  };

  /// 📣 အဖွဲ့ဖိတ်ခေါ် — ဒီ room ရဲ့ deep link ကို share (မရရင် clipboard)။
  /// အဖွဲ့နဲ့ ဆော့ဖို့ အလွယ်ဆုံးလမ်း — link နှိပ်ရင် တူတူ room ထဲ ရောက်တယ်။
  const invite = () => {
    const url = `${window.location.origin}/metaverse?room=${roomId}`;
    const nav = navigator as Navigator & {
      share?: (d: { url: string; title?: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      void nav.share({ url, title: "Gwave Metaverse — လာဆော့ကြ!" }).catch(() => {});
    } else {
      void navigator.clipboard?.writeText(url).catch(() => {});
    }
    setInvited(true);
    window.setTimeout(() => setInvited(false), 1800);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const map = getMap(roomId);
    setArenaHud({ weapons: {}, you: null, board: [], feed: [], denied: false });
    setHideHud({ phase: "waiting", endsAt: null, role: null, blindUntil: null, players: [], feed: [] });
    setShowBoard(false);
    setHitMark(null);
    setDmgOn(false);
    setBanner(null);
    setInvited(false);
    setAdsBoth(false);
    setCrouchOn(false);
    setDmgNums([]);
    setHurtFrom(null);
    arenaWeaponListRef.current = [];
    setBooted(false);

    /// Gwave app ရဲ့ WebView ထဲမှာ ဖွင့်နေလား (Phase 17)。
    /// ★ URL ရဲ့ `app=1` ကနေ ချက်ချင်း သိရတယ် — bridge ရောက်တာကို စောင့်ရင်
    /// ပထမ frame တွေက အရည်အသွေး မြင့်နေပြီး ပြီးမှ ခုန်ကျမယ်။
    const inApp = isInApp();

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    // ★ devicePixelRatio ကို ၂ မှာ ကန့်သတ် — iPhone က 3 ပြန်ပေးတယ်၊
    // pixel ၉ ဆ ဆွဲရတာက ဘက်ထရီကုန်ပြီး frame ကျတယ်။
    // ★ App (WebView) ထဲမှာ pixelRatio ကို 1 — WebView က browser ထက်
    // နှေးပြီး ဖုန်းက ပူလွယ်တယ်။ ရုပ်ထွက် အနည်းငယ် လျော့ပေမယ့် frame
    // တည်ငြိမ်တာက ပိုအရေးကြီးတယ် (spec 17.4)。
    renderer.setPixelRatio(inApp ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = !inApp;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      500,
    );

    const world = buildWorld(scene, map);

    // ★ App ထဲမှာ မြင်ကွင်းကို ချုံ့တယ် — ဝေးတဲ့အရာတွေ မဆွဲရတော့လို့
    // draw call နဲ့ fill rate နှစ်ခုစလုံး ကျတယ်။
    if (inApp && scene.fog instanceof THREE.Fog) {
      scene.fog.far = Math.min(scene.fog.far, 70);
    }

    // ── အရိပ် ───────────────────────────────────────────────────────────
    // ★ `renderer.shadowMap.enabled` ကို ပြောင်းပြီး material တွေကို
    // `needsUpdate` မလုပ်ရင် shader အဟောင်းက ဆက်သုံးနေလို့ ဘာမှမပြောင်းဘူး
    // (ဒါမှမဟုတ် အရိပ်နေရာမှာ အနက်ရောင် အကွက်တွေ ကျန်နေတယ်)။
    const applyShadows = (on: boolean) => {
      renderer.shadowMap.enabled = on;
      world.setShadows(on);
      scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (!mat) return;
        if (Array.isArray(mat)) for (const m of mat) m.needsUpdate = true;
        else mat.needsUpdate = true;
      });
    };
    shadowRef.current = applyShadows;
    applyShadows(window.localStorage.getItem(SHADOW_KEY) !== "0");

    // ── Post-processing (bloom) ───────────────────────────────────────────
    const postfx = createPostFx(
      renderer,
      scene,
      camera,
      mount.clientWidth,
      mount.clientHeight,
      bloomRef.current,
    );

    // ── ရာသီဥတု ───────────────────────────────────────────────────────────
    // ★ Client မှာ ကျပန်း မလုပ်ဘူး — server က ပြောတာကိုပဲ ပြတယ်။ မဟုတ်ရင်
    // ဘေးချင်းကပ်နေတဲ့ ၂ ယောက် တစ်ယောက်က မိုးထဲ၊ တစ်ယောက်က နေသာနေမယ်။
    const weather = createWeather(scene, world.ambient);
    weather.set(map.weather.default, 0.8, 0.6, 0.2);

    // ── Mini-game ရဲ့ အမှတ်အသားများ (Phase 16) ────────────────────────────
    const gameFx: GameFx = createGameFx(scene);

    // ── ⚔️ Game room feedback ────────────────────────────────────────────
    // ★ ပစ်ချက်တစ်ချက်မှာ အသံ + ကျည်လမ်းကြောင်း + မီးပွင့် မရှိရင်
    //   "ပစ်လို့မရဘူး" လို့ ခံစားရတယ် — server က မှန်နေလည်း client မှာ
    //   တုံ့ပြန်ချက် မရှိရင် ဂိမ်းက ပျက်နေသလိုပဲ။
    const isGameWorld = map.id === "arena" || map.id === "hide-1";
    const sfx: Sfx | null = isGameWorld ? createSfx(0.8) : null;
    const combatFx: CombatFx | null = map.id === "arena" ? createCombatFx(scene) : null;
    /// aYou ကနေ update ဖြစ်တဲ့ ကိုယ့် combat အခြေအနေ — fire feedback အတွက်
    const combat = { weapon: "pistol", alive: true, ammo: -1, prevWeapon: "knife" };
    /// လက်နက် fireMs — aInit က server တန်ဖိုးတွေနဲ့ ပြည့်တယ် (auto-fire နှုန်း)။
    /// Server ကလည်း ကိုယ့်ဘက်က ထပ်စစ်တယ် — ဒါက client ရဲ့ ကြိုကန့်သတ်ချက်ပဲ။
    const wFireMs: Record<string, number> = {};
    /// ပစ်ချိန် ကင်မရာ ခုန်တက်ချက် (recoil) — လက်နက်အလိုက်
    const RECOIL: Record<string, number> = {
      pistol: 0.014, knife: 0.004, sniper: 0.032, bomb: 0.01,
      smg: 0.006, shotgun: 0.034, revolver: 0.022,
    };
    /// 🎯 ADS FOV — sniper က scope အပြည့်၊ ကျန်တာ နည်းနည်းချုံ့
    const BASE_FOV = 60;
    const ADS_FOV: Record<string, number> = {
      sniper: 18, revolver: 38, pistol: 45, smg: 45, shotgun: 50, bomb: 50, knife: 55,
    };
    /// 💥 ပေါက်ကွဲမှု/ထိချက်က ကင်မရာ တုန်ခါမှု
    let shake = 0;
    let lastFireLocal = 0;
    let firing = false;

    // ── User ဆောက်ထားတဲ့ အရာများ (Phase 18) ───────────────────────────────
    // ★ InstancedMesh — type တစ်ခုချင်းကို draw call တစ်ခုစီ။ မဟုတ်ရင်
    // ကွက် ၄၉ ခု × object ၂၀၀ = draw call ၉,၈၀၀ ဖြစ်ပြီး ဖုန်းက မတင်ဘူး။
    const buildRender = createBuildRender(scene);
    const plots = createPlotStream(buildRender);
    const ghost = createGhost(scene);
    /// Ghost ရဲ့ လက်ရှိနေရာ — player ရဲ့ ရှေ့ ၃ unit ကို grid ပေါ် အံကိုက်
    const ghostAt = { x: 0, y: 0, z: 0 };
    let ghostType: BuildType | null = null;
    let ghostRy = 0;
    let ghostValid = false;

    // ── ယာဉ်များ ──────────────────────────────────────────────────────────
    const vehicles = new Map<string, Vehicle>();
    map.vehicles.forEach((v, i) => {
      const id = `${map.id}-v${i}`;
      const veh = createVehicle(id, v.kind, v.x, v.z, v.ry);
      scene.add(veh.group);
      vehicles.set(id, veh);
    });
    /// ကိုယ် မောင်းနေတဲ့ ယာဉ် — `null` = ခြေလျင်
    let riding: Vehicle | null = null;
    let nearVeh: Vehicle | null = null;

    // ── Gwave ချိတ်ဆက်မှုများ ─────────────────────────────────────────────
    // ★ world.colliders ထဲကို တိုက်ရိုက် push လုပ်တယ် — သင်ပုန်းက အစိုင်အခဲ
    const landmarks = buildLandmarks(scene, world.colliders);

    // ── မြို့လယ် live screen ───────────────────────────────────────────────
    // ★ mutable holder — board API က တကယ့် live URL ပြန်လာရင် အသစ်နဲ့
    // အစားထိုးတယ်။ Effect က ပြီးသွားပြီးမှ fetch ပြန်လာနိုင်လို့ cleanup က
    // ဒီ holder ကနေသာ dispose လုပ်ရမယ်။
    // ★ map မှာ live screen မရှိရင် attach မလုပ်ဘူး — နှင်းတောင်ထိပ်မှာ
    // ကြော်ငြာဆိုင်းဘုတ်ကြီး မလိုဘူး။
    let screen: LiveScreen | null = world.screenMesh
      ? attachLiveScreen(world.screenMesh, IVS_URL)
      : null;
    let liveUrl = IVS_URL;
    let killed = false;

    // ── Minimap ────────────────────────────────────────────────────────────
    const mapCanvas = mapRef.current;
    const minimap = mapCanvas
      ? createMinimap(mapCanvas, world.colliders, world.walkRadius)
      : null;

    // ── Spatial audio ─────────────────────────────────────────────────────
    // ★ ဒီမှာ AudioContext မဆောက်ဘူး — ဖွင့်တဲ့ခလုတ် နှိပ်မှသာ ဆောက်တယ်။
    const audio = createSpatialAudio();
    audioRef.current = audio;

    // ── နာမည်တံဆိပ် + အရည်အသွေး စောင့်ကြည့်မှု ────────────────────────────
    const tagHost = tagsRef.current;
    const nametags = tagHost ? createNametags(tagHost) : null;
    const quality = createQuality();

    /// လူကိုယ်တိုင် "ပြန်မြှင့်" နှိပ်တဲ့အခါ — pixelRatio နဲ့ warm-up ကိုပါ
    /// ပြန်ချိန်ရမယ်၊ မဟုတ်ရင် ရုပ်က ဝါးနေဆဲ ဖြစ်ပြီး ဒုတိယအကြိမ် ချက်ချင်း
    /// ပြန်လျှော့ခံရမယ်။
    restoreRef.current = () => {
      renderer.setPixelRatio(inApp ? 1 : Math.min(window.devicePixelRatio, 2));
      postfx.setSize(mount.clientWidth, mount.clientHeight);
      quality.reset();
    };

    // ── ကိုယ့်လူရုပ် ───────────────────────────────────────────────────────
    const me: Avatar = createHuman(0x44bba4, 0xe8b088);
    scene.add(me.group);
    // ★ သိမ်းထားတဲ့ avatar ကို ဖတ်ပြီး တင်တယ် — မရရင် default နဲ့ ဆက်သွားတယ်
    void fetch("/api/metaverse/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: AvatarConfig } | null) => {
        if (killed || !d?.config) return;
        applyAvatarConfig(me, sanitizeAvatar(d.config, new Set()));
      })
      .catch(() => {
        applyAvatarConfig(me, DEFAULT_AVATAR);
      });

    // Player ရဲ့ အခြေအနေ — ★ React state မဟုတ်၊ mutable object
    const p = {
      x: map.spawn.x,
      y: map.spawn.y,
      z: map.spawn.z,
      ry: map.spawn.ry,
      vy: 0,
      airborne: false,
    };
    const cam = { yaw: map.spawn.ry, pitch: 0.34, dist: 7.5 };

    const input: Input = {
      f: 0,
      b: 0,
      l: 0,
      r: 0,
      run: false,
      crouch: false,
      jump: false,
      jx: 0,
      jz: 0,
    };
    /// ကုပ်တာကို ချောချော ကူးပြောင်းဖို့ (0 = မတ်တပ်၊ 1 = ကုပ်)
    let crouchLerp = 0;

    // ── Multiplayer ───────────────────────────────────────────────────────
    const remotes = new Map<string, Remote>();

    /// ★ App ထဲမှာ တစ်ပြိုင်နက် ပြမယ့် လူအရေအတွက်ကို ကန့်သတ်တယ် —
    /// avatar တစ်ယောက်က mesh အများကြီးနဲ့ nametag တစ်ခုစီ ရှိတယ်၊
    /// ဖုန်းမှာ ၅၀ ယောက် ပြရင် frame က ကျတယ် (spec 17.4)。
    const MAX_REMOTES = inApp ? 20 : 80;

    const addRemote = (id: string, s: RemoteState) => {
      if (remotes.has(id)) return;
      if (remotes.size >= MAX_REMOTES) return;
      const avatar = createHuman(colorFor(id));
      avatar.group.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
      scene.add(avatar.group);
      remotes.set(id, {
        avatar,
        cur: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        target: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        name: s.name ?? "Gwave",
        emote: (s.emote as HumanState["emote"]) ?? null,
        speed: 0,
      });
      nametags?.add(id, s.name ?? "Gwave", s.authed !== false);
      setOnline(remotes.size + 1);
    };

    const dropRemote = (id: string) => {
      const r = remotes.get(id);
      if (!r) return;
      r.avatar.dispose();
      remotes.delete(id);
      audio.drop(id);
      nametags?.remove(id);
      setOnline(remotes.size + 1);
    };

    // ── နေ့/ည — server နာရီနဲ့ ချိန် ───────────────────────────────────────
    // ★ Player တိုင်း **တူညီတဲ့ အချိန်** မြင်ရမယ်။ client တစ်ခုစီက ကိုယ့်
    // ဘာသာ ရေတွက်ရင် နောက်ကျဝင်လာသူက မနက်ခင်း၊ ရှေ့ကလူက ည — တစ်လောကထဲမှာ
    // ရှိပြီး မိုးကောင်းကင် ၂ မျိုး ဖြစ်နေမယ်။ epoch ကနေ တွက်လိုက်တော့
    // ခေါ်ဆိုမှု မလိုဘဲ တူညီသွားတယ်၊ server ရဲ့ နာရီနဲ့ ကွာတာကိုပဲ
    // offset အဖြစ် သိမ်းထားတယ်။
    let clockOffset = 0;
    const dayMs = DAY_SECONDS * 1000;
    const worldTimeNow = () => (((Date.now() + clockOffset) % dayMs) / dayMs);

    let net: NetClient | null = null;
    /// ⚔️ combat position packet ရဲ့ နောက်ဆုံးပို့ချိန် (10Hz throttle)
    let lastAMoveAt = 0;
    /// ★ ကိုယ့် id — ကစားသူထဲ ပါလား (ကစားနေတာလား ကြည့်နေတာလား) ခွဲဖို့။
    /// React state က closure ထဲ အဟောင်း ဖမ်းထားလို့ effect ထဲမှာ ကိုယ်ပိုင်
    /// ကူးထားတယ်။
    let myId = "";
    /// ပွဲပြီးရင် marker တွေ ဖျောက်ဖို့
    const clearGameFx = () => {
      gameFx.setObjectives([]);
      gameFx.setArena(null);
    };
    const wsUrls = wsCandidates();
    if (wsUrls.length > 0) {
      net = connectMetaverse(wsUrls, roomId, {
        onInit: ({ id, players, name, authed, serverTime, games }) => {
          for (const [rid, s] of Object.entries(players)) addRemote(rid, s);
          setMeName(name);
          setMeAuthed(authed);
          myId = id;
          setMeId(id);
          setGameList(games);
          setLink("live");
          // ⚔️ Game room ဆိုရင် combat layer ထဲ ချက်ချင်း ဝင်တယ် — login/
          // socket အသစ် မလို၊ ဒီ connection ပေါ်မှာပဲ။
          if (roomId === "arena") net?.sendRaw({ type: "aJoin" });
          if (roomId === "hide-1") net?.sendRaw({ type: "gJoin" });
          // ဖုန်းရဲ့ နာရီ မမှန်လည်း server နဲ့ တူညီအောင်
          clockOffset = serverTime - Date.now();
        },
        onJoin: (id, s) => addRemote(id, s),
        onLeave: dropRemote,
        onUpdate: (id, x, y, z, ry) => {
          const r = remotes.get(id);
          if (!r) return;
          // ★ target ကိုပဲ ချိန်တယ် — cur ကို frame တိုင်း ဆွဲသွားမယ်။
          // တိုက်ရိုက်ထည့်ရင် 15Hz packet အတိုင်း ခုန်ခုန်သွားမယ်။
          r.target.x = x;
          r.target.y = y;
          r.target.z = z;
          r.target.ry = ry;
        },
        onEmote: (id, e) => {
          const r = remotes.get(id);
          if (r) r.emote = (e as HumanState["emote"]) ?? null;
        },
        onChat: (id, name, text, authed) => {
          setChat((prev) => [
            ...prev.slice(-40),
            { id, name, text, at: Date.now(), authed },
          ]);
        },
        onName: (id, name) => {
          const r = remotes.get(id);
          if (r) r.name = name;
          // setname က ဧည့်သည်ကသာ ပို့လို့ရတယ် (server က signed-in user ကို
          // ငြင်းတယ်) — ဒါကြောင့် အမှတ်အသားက "ဧည့်သည်" အတိုင်း ကျန်တယ်
          nametags?.rename(id, name);
        },
        onWeather: (kind, intensity, wx, wz) => {
          // ★ map က ခွင့်ပြုထားတဲ့ ရာသီဥတုကိုသာ လက်ခံတယ် — server က
          // မှားပို့လိုက်ရင် နှင်းတောင်ထိပ်မှာ aurora ဖြစ်နေမယ်။
          const allowed = map.weather.allowed as string[];
          const k = allowed.includes(kind) ? kind : map.weather.default;
          weather.set(k as typeof map.weather.default, intensity, wx, wz);
        },
        onVehicle: (id, x, y, z, ry, speed) => {
          const v = vehicles.get(id);
          // ★ ကိုယ်မောင်းနေတဲ့ ယာဉ်ရဲ့ echo ကို လက်မခံဘူး — လက်ခံရင်
          // ကိုယ့်နေရာက server ရဲ့ နောက်ကျတဲ့ တန်ဖိုးဆီ ဆွဲသွားပြီး တုန်မယ်။
          if (!v || v === riding) return;
          v.setTarget(x, y, z, ry, speed);
        },
        onMounted: (vehicleId, playerId) => {
          const v = vehicles.get(vehicleId);
          if (v) v.driver = playerId;
        },
        onDismounted: (vehicleId) => {
          const v = vehicles.get(vehicleId);
          if (v) v.driver = null;
        },
        onCorrect: (x, y, z) => {
          // Server က ငြင်းလိုက်တယ် — server ရဲ့ နေရာက အမှန်။
          p.x = x;
          p.y = y;
          p.z = z;
        },

        // ── Mini-game (Phase 16) ────────────────────────────────────────
        onGameInvite: ({ gameId, nameMy, arena, startsIn, joined }) => {
          gameFx.setArena(arena);
          setPhase({
            kind: "lobby",
            gameId,
            nameMy,
            startsAt: Date.now() + startsIn * 1000,
            joined: joined.length,
          });
        },
        onGameStart: ({ gameId, nameMy, arena, players: ids, durationSec }) => {
          gameFx.setArena(arena);
          setPhase({
            kind: "playing",
            gameId,
            nameMy,
            // ★ ကစားသူထဲ မပါရင် **ကြည့်နေသူ** — ဝင်မကစားရပေမယ့်
            // အမှတ်ပြားကို မြင်ရမယ် (spec 16.6)。
            playing: ids.includes(myId),
            // ★ ပထမ tick မရောက်ခင် 0:00 ပြရင် "ပွဲပြီးသွားပြီ" လို့ ထင်မယ်
            timeLeft: durationSec,
            scores: [],
          });
        },
        onGameState: ({ timeLeft, scores }) => {
          setPhase((prev) =>
            prev.kind === "playing" ? { ...prev, timeLeft, scores } : prev,
          );
        },
        onGameObjectives: (objectives) => gameFx.setObjectives(objectives),
        onGameEnd: ({ gameId, rankings }) => {
          clearGameFx();
          setPhase({
            kind: "ended",
            gameId,
            rankings,
            won: rankings[0]?.playerId === myId,
          });
        },
        onGameCancelled: () => {
          clearGameFx();
          setPhase({ kind: "idle" });
        },

        // ── Voice (Phase 14) ────────────────────────────────────────────
        onVoicePeers: (peers) => {
          voiceChat.onPeers(peers);
          setVoicePeers(peers);
          setVoiceState("on");
        },
        onVoiceSignal: (from, data) => void voiceChat.onSignal(from, data),
        onVoiceState: (id, muted) => {
          setVoicePeers((prev) =>
            prev.map((p) => (p.id === id ? { ...p, muted } : p)),
          );
        },
        onVoiceLeft: (id) => {
          voiceChat.onLeft(id);
          setVoicePeers((prev) => prev.filter((p) => p.id !== id));
        },
        onVoiceDenied: (reason) => {
          voiceChat.leave();
          setVoiceState(
            reason === "age"
              ? "denied-age"
              : reason === "full"
                ? "denied-full"
                : "denied-auth",
          );
        },
        onRaw: (m) => {
          // 🙈 ဝှက်တမ်း game layer — position က presence ကနေ server ဘက်မှာ
          // sync ဖြစ်ပြီးသား (arena.js syncPositions)၊ ဒီမှာ ပွဲအခြေအနေပဲ။
          if (roomId === "hide-1") {
            const hFeed = (text: string, good: boolean) =>
              setHideHud((h) => ({
                ...h,
                feed: [...h.feed.slice(-4), { text, good, at: Date.now() }],
              }));
            const nameOf = (id: unknown) =>
              id === myId ? "မင်း" : remotes.get(String(id))?.name ?? "ကစားသမား";
            const asPhase = (st: unknown): "waiting" | "countdown" | "live" | "ended" =>
              st === "countdown" || st === "live" || st === "ended" ? st : "waiting";
            switch (m.type) {
              case "gJoined":
                setHideHud((h) => ({
                  ...h,
                  phase: asPhase(m.state),
                  endsAt: Number(m.countdownEndsAt) || Number(m.endsAt) || null,
                }));
                break;
              case "gDenied":
                hFeed("ခဏ ဝင်လို့မရသေး — စောင့်ပြီး ပြန်စမ်းပါ", false);
                break;
              case "gState": {
                const phase = asPhase(m.state);
                setHideHud((h) => ({
                  ...h,
                  phase,
                  endsAt: Number(m.endsAt) || (phase === "waiting" ? null : h.endsAt),
                  role: phase === "waiting" ? null : h.role,
                  players: Array.isArray(m.players)
                    ? (m.players as HidePlayer[])
                    : h.players,
                }));
                if (phase === "live") {
                  sfx?.kill(true);
                  hFeed("ပွဲ စပါပြီ — ပုန်းကြ!", true);
                }
                if (phase === "ended") {
                  sfx?.win();
                  hFeed("ပွဲ ပြီးပါပြီ", true);
                }
                break;
              }
              case "gEvent":
                switch (m.kind) {
                  case "role":
                    setHideHud((h) => ({
                      ...h,
                      role:
                        m.id === myId
                          ? "seeker"
                          : h.role === "seeker" || h.role === null
                            ? "hider"
                            : h.role,
                    }));
                    hFeed(
                      m.id === myId
                        ? "🔦 မင်းက ရှာဖွေသူ — ဖမ်းလိုက်!"
                        : `🔦 ${nameOf(m.id)} က ရှာဖွေသူ`,
                      m.id !== myId,
                    );
                    break;
                  case "blind":
                    setHideHud((h) => ({ ...h, blindUntil: Number(m.until) || null }));
                    break;
                  case "tagged":
                    sfx?.hitMarker(false);
                    hFeed(`🖐 ${nameOf(m.id)} အဖမ်းခံရပြီ`, m.id !== myId);
                    break;
                  case "score":
                    setHideHud((h) => ({
                      ...h,
                      players: h.players.map((q) =>
                        q.id === m.id ? { ...q, score: Number(m.score) || q.score } : q,
                      ),
                    }));
                    break;
                }
                break;
              case "gLeft":
                if (Array.isArray(m.ids)) {
                  const gone = new Set((m.ids as unknown[]).map(String));
                  setHideHud((h) => ({
                    ...h,
                    players: h.players.filter((q) => !gone.has(q.id)),
                  }));
                }
                break;
            }
            return;
          }
          // ⚔️ Assassin combat layer — game room မှာသာ။ Position rendering က
          // ပုံမှန် presence (update/state) အတိုင်း avatar တွေနဲ့ပဲ သွားတယ်၊
          // ဒီမှာက ကစားမှုအခြေအနေ (hp/target/kill feed) ပဲ ကိုင်တယ်။
          if (roomId !== "arena") return;
          const pushFeed = (text: string, good: boolean) =>
            setArenaHud((h) => ({
              ...h,
              feed: [...h.feed.slice(-4), { text, good, at: Date.now() }],
            }));
          const teleportMe = (players: unknown) => {
            const mine = (players as { id: string; x?: number; z?: number }[] | undefined)?.find(
              (q) => q.id === myId,
            );
            if (mine && Number.isFinite(mine.x) && Number.isFinite(mine.z)) {
              p.x = Number(mine.x);
              p.z = Number(mine.z);
            }
          };
          /// ကြေညာစာတန်း — 2.2s ကြာရင် အလိုအလျောက် ပျောက်တယ်
          const flashBanner = (text: string, tone: "good" | "bad") => {
            const at = Date.now();
            setBanner({ text, tone, at });
            window.setTimeout(() => {
              if (!killed) setBanner((b) => (b?.at === at ? null : b));
            }, 2200);
          };
          switch (m.type) {
            case "aInit":
              setArenaHud((h) => ({
                ...h,
                weapons: (m.weapons as Record<string, { my: string }>) ?? {},
                board: (m.players as ArenaBoardRow[]) ?? [],
              }));
              arenaWeaponListRef.current = Object.keys(
                (m.weapons as Record<string, unknown>) ?? {},
              );
              for (const [wk, wv] of Object.entries(
                (m.weapons as Record<string, { fireMs?: number }>) ?? {},
              )) {
                wFireMs[wk] = Number(wv?.fireMs) || 350;
              }
              teleportMe(m.players);
              break;
            case "aYou": {
              const you = m.you as ArenaYou;
              if (you.weapon !== combat.weapon) combat.prevWeapon = combat.weapon;
              combat.weapon = you.weapon;
              combat.alive = you.alive;
              combat.ammo = you.ammo?.[you.weapon] ?? -1;
              setArenaHud((h) => ({ ...h, you }));
              break;
            }
            case "aBoom": {
              // 💥 ဗုံးပေါက်ကွဲမှု — server က ပေါက်ကွဲတဲ့နေရာ x,z + radius ပို့တယ်
              const bx = Number(m.x);
              const bz = Number(m.z);
              const br = Number(m.radius) || 6;
              if (Number.isFinite(bx) && Number.isFinite(bz)) {
                combatFx?.boom(bx, bz, br);
                sfx?.shot("bomb");
                const d = Math.hypot(bx - p.x, bz - p.z);
                if (d < 25) shake = Math.max(shake, 0.4 * (1 - d / 25));
              }
              break;
            }
            case "aShot": {
              // တခြားသူ ပစ်တာ — သူ့နေရာကနေ ကျည်လမ်းကြောင်း + အသံ။
              // ကိုယ့်ပစ်ချက်ကတော့ arenaFireRef မှာ ချက်ချင်း ပြပြီးသား။
              if (m.id === myId) break;
              const sx = Number(m.x);
              const sy = Number(m.y);
              const sz = Number(m.z);
              const sry = Number(m.ry);
              if ([sx, sy, sz, sry].every(Number.isFinite)) {
                const from = new THREE.Vector3(sx, sy + 1.35, sz);
                const dir = new THREE.Vector3(Math.sin(sry), 0, Math.cos(sry));
                combatFx?.tracer(from, dir, 30);
                combatFx?.muzzle(from);
              }
              sfx?.shot(String(m.weapon || "pistol"));
              break;
            }
            case "aEnter": {
              const q = m.player as ArenaBoardRow;
              setArenaHud((h) => ({
                ...h,
                board: [...h.board.filter((b) => b.id !== q.id), q],
              }));
              break;
            }
            case "aLeave":
              setArenaHud((h) => ({
                ...h,
                board: h.board.filter((b) => b.id !== m.id),
              }));
              break;
            case "aHit":
              if (m.attackerId === myId) {
                sfx?.hitMarker(m.hitPart === "head");
                const at = Date.now();
                setHitMark({ head: m.hitPart === "head", at });
                window.setTimeout(() => {
                  if (!killed) setHitMark((h) => (h?.at === at ? null : h));
                }, 200);
                // ဒဏ်ရာဂဏန်း — crosshair ဘေး "-34" ပေါ်ပြီး မှေးသွားတယ်
                const dmg = Number(m.dmg);
                if (Number.isFinite(dmg) && dmg > 0) {
                  const id = at + Math.random();
                  setDmgNums((list) => [
                    ...list.slice(-3),
                    { id, text: `-${dmg}`, head: m.hitPart === "head" },
                  ]);
                  window.setTimeout(() => {
                    if (!killed) setDmgNums((list) => list.filter((n) => n.id !== id));
                  }, 700);
                }
                pushFeed(m.hitPart === "head" ? "ခေါင်းထိ ✓✓" : "ထိမှန်တယ် ✓", true);
              }
              if (m.victimId === myId) {
                sfx?.hurt();
                setDmgOn(true);
                shake = Math.max(shake, 0.12);
                window.setTimeout(() => {
                  if (!killed) setDmgOn(false);
                }, 320);
                // အထိခံရတဲ့ ဦးတည်ရာ မြှား — ပစ်သူက ဘယ်ဘက်ကလဲ သိရအောင်
                const att = remotes.get(String(m.attackerId));
                if (att) {
                  const ang =
                    Math.atan2(att.cur.x - p.x, att.cur.z - p.z) - cam.yaw;
                  const deg = Math.round((-ang * 180) / Math.PI);
                  const hAt = Date.now();
                  setHurtFrom({ deg, at: hAt });
                  window.setTimeout(() => {
                    if (!killed) setHurtFrom((h) => (h?.at === hAt ? null : h));
                  }, 700);
                }
                pushFeed("အထိခံရတယ်", false);
              }
              break;
            case "aKill":
              pushFeed(
                `${m.killerName} → ${m.victimName}${m.correct === true ? " ✓" : " ✗ (လူမှား)"}`,
                m.correct === true,
              );
              if (m.killerId === myId) {
                sfx?.kill(m.correct === true);
                flashBanner(
                  m.correct === true
                    ? `☠️ ${m.victimName} ကို သတ်လိုက်ပြီ!`
                    : `✗ လူမှားသွားပြီ — ${m.victimName}`,
                  m.correct === true ? "good" : "bad",
                );
              } else if (m.victimId === myId) {
                sfx?.hurt();
                flashBanner(`☠️ ${m.killerName} က မင်းကို သတ်သွားပြီ`, "bad");
              }
              setArenaHud((h) => ({
                ...h,
                board: h.board.map((b) =>
                  b.id === m.killerId
                    ? { ...b, score: Number(m.killerScore) || b.score }
                    : b,
                ),
              }));
              break;
            case "aRespawn":
              if (m.id === myId) {
                p.x = Number(m.x);
                p.z = Number(m.z);
                sfx?.reload();
                combatFx?.ring(p.x, p.z, 0x4ade80);
                flashBanner("💚 ပြန်ရှင်ပြီ — သတိထား", "good");
              }
              break;
            case "aWin":
              sfx?.win();
              flashBanner(
                m.winnerId === myId
                  ? "🏆 မင်း အနိုင်ရပါပြီ!"
                  : `🏆 ${m.winnerName} အနိုင်ရပါပြီ`,
                "good",
              );
              break;
            case "aReset":
              setArenaHud((h) => ({
                ...h,
                board: (m.players as ArenaBoardRow[]) ?? [],
              }));
              teleportMe(m.players);
              flashBanner("🔔 ပွဲအသစ် စပါပြီ", "good");
              break;
            case "aNoAmmo":
              sfx?.empty();
              pushFeed("ကျည် ကုန်ပြီ — R / 🔄 နဲ့ ဖြည့်ပါ", false);
              break;
          }
        },
        onStatus: (connected, detail) => {
          if (connected) setLink("live");
          else if (detail === "auth") setLink("auth");
          else if (detail === "denied") {
            // ⚔️ ၁၈+ ဂိတ်က server ရဲ့ ဆုံးဖြတ်ချက် (4005/4006) — retry မလုပ်။
            setLink("auth");
            setArenaHud((h) => ({ ...h, denied: true }));
          } else setLink("connecting");
        },
      });
      netRef.current = net;
      // ⚔️ ပစ်ခတ်မှု — ကင်မရာ ကြည့်နေတဲ့ **ဦးတည်ချက်ပဲ** ပို့တယ်။ ဘယ်သူ
      // ထိလဲ ဆုံးဖြတ်တာ server (A4 server-authoritative) — origin/target
      // ကို client က လိမ်လို့ မရဘူး။
      const fireOnce = () => {
        if (roomId !== "arena") return;
        sfx?.resume();
        if (!combat.alive) return;
        // Client-side ကြို-cooldown — server fireMs ကို မကျော်အောင်
        // (ဖိထားပစ်တဲ့ auto-fire က frame တိုင်း ခေါ်လို့)။
        const now = Date.now();
        const fireMs = wFireMs[combat.weapon] ?? 320;
        if (now - lastFireLocal < fireMs) return;
        lastFireLocal = now;

        // ★★ ချိန်ချက် — server က ray ကို **player ရဲ့ မျက်လုံး** ကနေ ပစ်တယ်၊
        //   ကင်မရာကနေ မဟုတ်ဘူး။ Third-person မှာ ကင်မရာက နောက်မှာ
        //   အောက်စိုက်ကြည့်နေလို့ ကင်မရာ direction ကို တိုက်ရိုက်ပို့ရင်
        //   server ray က မြေထဲ စိုက်ဝင်ပြီး **ဘယ်တော့မှ မထိဘူး** — ဒါက
        //   "ပစ်လို့မရဘူး" ရဲ့ ဇစ်မြစ်။ ဒါကြောင့် crosshair ချိန်ထားတဲ့
        //   အဝေးမှတ်ကို ရှာပြီး မျက်လုံးကနေ အဲဒီမှတ်ဆီ converge လုပ်တယ် —
        //   FP မှာရော TP မှာရော တိကျတယ်။
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const aimAt = camera.position.clone().addScaledVector(camDir, 60);
        const eye = new THREE.Vector3(p.x, p.y + 1.6, p.z);
        const d = aimAt.sub(eye).normalize();

        // ★ Server ကို မစောင့်ဘဲ ချက်ချင်း တုံ့ပြန်တယ် — အသံ/ကျည်လမ်းကြောင်း
        //   နောက်ကျရင် "ပစ်လို့မရဘူး" လို့ ခံစားရတယ်။ ထိမထိကတော့ server
        //   (aHit/aKill) ကပဲ ဆုံးဖြတ်တယ်။
        if (combat.ammo !== 0) {
          sfx?.shot(combat.weapon);
          combatFx?.tracer(eye.clone().addScaledVector(d, 0.9), d, 40);
          combatFx?.muzzle(eye.clone().addScaledVector(d, 0.9));
          // Recoil — ကင်မရာ အပေါ်ခုန် + ဘေးယိမ်းအနည်းငယ် (PUBG-style)
          const rec = RECOIL[combat.weapon] ?? 0.012;
          cam.pitch = THREE.MathUtils.clamp(cam.pitch - rec, -1.2, 1.2);
          cam.yaw += (Math.random() - 0.5) * rec * 0.6;
        }

        // 💣 ဗုံး — ပစ်မှတ်မြေမှတ် x,z ပါ ပို့တယ်။ မပို့ရင် server က
        //   ကိုယ့်ခြေရင်းမှာ ဖောက်ခွဲပြီး ကိုယ့်ကိုယ်ကိုယ် ထိတယ်!
        if (combat.weapon === "bomb") {
          const target = eye.clone().addScaledVector(d, 15);
          net?.sendRaw({ type: "aFire", dx: d.x, dy: d.y, dz: d.z, x: target.x, z: target.z });
        } else {
          net?.sendRaw({ type: "aFire", dx: d.x, dy: d.y, dz: d.z });
        }
      };
      arenaFireRef.current = fireOnce;
      // 🔫 ဖိထား = ဆက်ပစ် — SMG လို လက်နက်တွေအတွက် (နှုန်းက fireMs အတိုင်း)
      arenaFireHoldRef.current = (down) => {
        firing = down;
        if (down) fireOnce();
      };
      arenaReloadRef.current = () => {
        if (roomId !== "arena") return;
        sfx?.resume();
        sfx?.reload();
        net?.sendRaw({ type: "aReload" });
      };
      arenaWeaponPickRef.current = (key) => {
        if (roomId !== "arena") return;
        sfx?.resume();
        net?.sendRaw({ type: "aWeapon", weapon: key });
      };
      // 🙈 ဖမ်းခြင်း — အနီးဆုံး ကစားသမားကို ရွေးပြီး server ကို တင်ပြတယ်။
      // အကွာအဝေး (TAG_RANGE) နဲ့ cooldown ကို **server က** စစ်တယ် —
      // ဒီ 2.2 က ခလုတ်နှိပ်သူကို အလကား packet မပို့စေဖို့ ကြိုစစ်တာပဲ။
      hideTagRef.current = () => {
        if (roomId !== "hide-1") return;
        let best: { id: string; d: number } | null = null;
        for (const [rid, r] of remotes) {
          const d = Math.hypot(r.cur.x - p.x, r.cur.z - p.z);
          if (d < 2.2 && (!best || d < best.d)) best = { id: rid, d };
        }
        if (best) {
          net?.sendRaw({ type: "gAction", action: { type: "tag", targetId: best.id } });
        }
      };
      // ★ `ry` ကို client က ပို့ပေမယ့် **ထိမထိ ဆုံးဖြတ်တာက server** —
      // ဒါက "ဘယ်ကို ကြည့်နေလဲ" ဆိုတဲ့ input သာ ဖြစ်တယ်၊ ရလဒ် မဟုတ်ဘူး။
      gameActionRef.current = (a) => net?.sendGameAction({ ...a, ry: p.ry });
    }

    // ── Voice chat (Phase 14) ────────────────────────────────────────────
    // ★ Audio က P2P — server က signal relay နဲ့ ၁၈+ ဂိတ်ပဲ။ Spatial က
    // PannerNode (HRTF) — voicechat.ts ကြည့်ပါ။
    const voiceChat = createVoiceChat(
      () => netRef.current,
      () => myId,
      async () => {
        const res = await fetch("/api/webrtc/ice", { cache: "no-store" });
        if (!res.ok) return [];
        const json = (await res.json()) as { iceServers?: RTCIceServer[] };
        return json.iceServers ?? [];
      },
    );
    voiceRef.current = voiceChat;
    nameOfRef.current = (id) => remotes.get(id)?.name ?? "Gwave";

    // ── Panel ↔ 3D ရဲ့ တံတား (Phase 18) ──────────────────────────────────
    buildRef.current = {
      ghostPos: () => ({ ...ghostAt }),
      setGhost: (type, ry, valid) => {
        ghostType = type;
        ghostRy = ry;
        ghostValid = valid;
        if (!type) ghost.hide();
      },
      setDraft: (plotId, objects) => plots.setDraft(plotId, objects),
      plotHere: () => plots.plotAt(p.x, p.z),
      invalidate: () => plots.invalidate(),
    };

    // ── စီး / ဆင်း ────────────────────────────────────────────────────────
    const toggleRide = () => {
      if (riding) {
        // ★ ယာဉ်ဘေး ၁.၅ unit မှာ ချတယ် — ယာဉ်ထဲမှာ ချရင် ကပ်နေမယ်
        p.x = riding.state.x + Math.cos(riding.state.ry) * 1.8;
        p.z = riding.state.z - Math.sin(riding.state.ry) * 1.8;
        p.y = 0;
        riding.state.speed = 0;
        riding.driver = null;
        net?.sendDismount();
        riding = null;
        me.group.visible = true;
        setRide(nearVeh ? { label: nearVeh.spec.label, riding: false } : null);
        return;
      }
      if (!nearVeh || nearVeh.driver) return;
      riding = nearVeh;
      riding.driver = "me";
      // ★ avatar ကို ဖျောက်တယ် — ယာဉ်ပေါ် ထိုင်နေတဲ့ပုံ တိတိကျကျ ထားဖို့
      // အဆစ်တွေ ချိန်ရမှာမို့ ဒီအဆင့်မှာ ဖျောက်တာက ရိုးရှင်းပြီး
      // မှားနေတာထက် ကောင်းတယ်။
      me.group.visible = false;
      net?.sendMount(riding.id);
      setRide({ label: riding.spec.label, riding: true });
    };
    rideRef.current = toggleRide;

    // ── First-person / third-person ပြောင်း ──────────────────────────────
    // ★ ref (render loop အတွက်) နဲ့ state (ခလုတ် UI အတွက်) နှစ်ခုလုံး
    // တစ်ပြိုင်နက် ပြောင်းရတယ် — မဟုတ်ရင် ခလုတ်က မမီဘူး။
    const setFpView = (on: boolean) => {
      fpvRef.current = on;
      setFpv(on);
      // FP ကနေ ပြန်ထွက်ရင် ကင်မရာကို နီးနီးလေးက စတယ် — ချက်ချင်း
      // အဝေးကြီး ခုန်သွားရင် မျက်စိလည်တယ်။ Pointer lock လည်း လွှတ်တယ်။
      if (!on) {
        cam.dist = Math.max(cam.dist, 4);
        if (document.pointerLockElement) document.exitPointerLock();
      }
    };
    fpvSetRef.current = setFpView;
    // ⚔️ ပွဲကွင်းက FPS ဂိမ်း — first-person နဲ့ စတယ် (crosshair နဲ့
    // ချိန်တာက ကင်မရာဦးတည်ချက်မို့ FP မှာမှ တိကျတယ်)။ V နဲ့ ပြန်ထွက်လို့ရတယ်။
    if (map.id === "arena") setFpView(true);
    // 🧎 ဖုန်း ကုပ်ခလုတ် — React ခလုတ်ကနေ effect ထဲက input ကို တိုက်ရိုက်ထိတယ်
    crouchSetRef.current = (on) => {
      input.crouch = on;
    };

    // ── Keyboard ──────────────────────────────────────────────────────────
    const keyMap: Record<string, keyof Input> = {
      KeyW: "f",
      ArrowUp: "f",
      KeyS: "b",
      ArrowDown: "b",
      KeyA: "l",
      ArrowLeft: "l",
      KeyD: "r",
      ArrowRight: "r",
    };

    // ★ Chat ရိုက်နေတုန်း WASD က လူရုပ်ကို ရွှေ့သွားလို့မရဘူး — စာရိုက်နေရင်း
    // လောကထဲမှာ ပြေးနေတာ ဖြစ်မယ်။
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = keyMap[e.code];
      if (k) {
        (input[k] as number) = 1;
        e.preventDefault();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.run = true;
      // CS လိုပဲ Ctrl = ကုပ်
      if (e.code === "ControlLeft" || e.code === "ControlRight") input.crouch = true;
      if (e.code === "Space") {
        input.jump = true;
        e.preventDefault();
      }
      if (e.code === "KeyE") toggleRide();
      if (e.code === "KeyV") setFpView(!fpvRef.current);
      // ⚔️ Game room ခလုတ်များ — R ကျည်ဖြည့် · 1-7 လက်နက် · Q အရင်လက်နက် ·
      // Tab အမှတ်စာရင်း
      if (map.id === "arena") {
        if (e.code === "KeyR") arenaReloadRef.current?.();
        if (e.code === "KeyQ") {
          const prev = combat.prevWeapon;
          if (prev && prev !== combat.weapon) arenaWeaponPickRef.current?.(prev);
        }
        const dig = /^Digit([1-7])$/.exec(e.code);
        if (dig) {
          const key = arenaWeaponListRef.current[Number(dig[1]) - 1];
          if (key) arenaWeaponPickRef.current?.(key);
        }
      }
      if (isGameWorld && e.code === "Tab") {
        setShowBoard(true);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = keyMap[e.code];
      if (k) (input[k] as number) = 0;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.run = false;
      if (e.code === "ControlLeft" || e.code === "ControlRight") input.crouch = false;
      if (e.code === "Space") input.jump = false;
      if (isGameWorld && e.code === "Tab") setShowBoard(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── ကင်မရာ drag ───────────────────────────────────────────────────────
    let dragId: number | null = null;
    let dragX = 0;
    let dragY = 0;
    const onPointerDown = (e: PointerEvent) => {
      // Browser က user gesture မတိုင်ခင် audio ခွင့်မပြုလို့ ဒီမှာ ဖွင့်တယ်
      sfx?.resume();
      // Joystick ဧရိယာက touch ကို ကင်မရာ မယူရ
      if ((e.target as HTMLElement).dataset?.hud) return;
      // ⚔️ Pointer lock ထဲ (first-person) — PUBG အတိုင်း:
      //   left ဖိထား = ဆက်ပစ် · right ဖိထား = 🎯 ADS ချိန်ကွင်း
      if (roomId === "arena" && document.pointerLockElement === el) {
        if (e.button === 2) setAdsBoth(true);
        else arenaFireHoldRef.current?.(true);
        return;
      }
      // ★ First-person + mouse — CS လိုပဲ click တစ်ချက်နဲ့ pointer lock
      //   ဝင်ပြီး mouse ရွှေ့ရုံနဲ့ ကြည့်လို့ရတယ် (drag မလိုတော့ဘူး)။
      //   Esc နဲ့ ပြန်လွတ်တယ် — browser ရဲ့ built-in။
      if (
        fpvRef.current &&
        e.pointerType === "mouse" &&
        document.pointerLockElement !== el
      ) {
        el.requestPointerLock?.();
        return;
      }
      dragId = e.pointerId;
      dragX = e.clientX;
      dragY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      // 🎯 ADS ချိန်နေချိန် sensitivity ကို FOV အချိုးအတိုင်း လျှော့တယ် —
      // scope ချဲ့ထားချိန် ကင်မရာ မြန်လွန်းရင် ချိန်လို့မရဘူး (PUBG စည်းမျဉ်း)
      const sens = map.id === "arena" ? camera.fov / BASE_FOV : 1;
      // Pointer lock ထဲမှာ — movementX/Y နဲ့ တိုက်ရိုက်လှည့်တယ်
      if (document.pointerLockElement === el) {
        cam.yaw -= e.movementX * 0.0028 * sens;
        cam.pitch = THREE.MathUtils.clamp(
          cam.pitch + e.movementY * 0.0022 * sens,
          fpvRef.current ? -1.2 : -0.25,
          1.2,
        );
        return;
      }
      if (dragId !== e.pointerId) return;
      cam.yaw -= (e.clientX - dragX) * 0.005 * sens;
      // ★ FP မှာ မော့ကြည့်လို့ရအောင် pitch ကို အောက်ဘက် ပိုကျယ်ပေးတယ် —
      // third-person မှာတော့ မြေအောက် မြင်သွားမှာမို့ -0.25 ပဲ။
      cam.pitch = THREE.MathUtils.clamp(
        cam.pitch + (e.clientY - dragY) * 0.004 * sens,
        fpvRef.current ? -1.2 : -0.25,
        1.2,
      );
      dragX = e.clientX;
      dragY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragId === e.pointerId) dragId = null;
      // ⚔️ ဖိထားတာ လွှတ်ရင် ပစ်ရပ် / ADS ထွက်
      if (roomId === "arena") {
        if (e.button === 2) setAdsBoth(false);
        else if (e.button === 0) arenaFireHoldRef.current?.(false);
      }
    };
    const onWheel = (e: WheelEvent) => {
      // ⚔️ ပွဲကွင်းမှာ wheel = လက်နက်လှိမ့်ပြောင်း (PUBG) — zoom က V နဲ့
      if (map.id === "arena") {
        const list = arenaWeaponListRef.current;
        if (list.length > 0) {
          const cur = Math.max(0, list.indexOf(combat.weapon));
          const next = (cur + (e.deltaY > 0 ? 1 : list.length - 1)) % list.length;
          const key = list[next];
          if (key && key !== combat.weapon) arenaWeaponPickRef.current?.(key);
        }
        e.preventDefault();
        return;
      }
      if (fpvRef.current) {
        // FP ထဲမှာ zoom ထုတ်ရင် third-person ပြန်ထွက်တယ် (game convention)
        if (e.deltaY > 0) setFpView(false);
      } else {
        const next = cam.dist + e.deltaY * 0.01;
        // Zoom အဆုံးကျော်အောင် ဆက်ဆွဲရင် first-person ဝင်တယ်
        if (next < 2.2) setFpView(true);
        cam.dist = THREE.MathUtils.clamp(next, 3, 18);
      }
      e.preventDefault();
    };
    const el = renderer.domElement;
    // ⚔️ Right-click = ADS မို့ context menu မတက်ရ
    const onCtxMenu = (e: Event) => {
      if (map.id === "arena") e.preventDefault();
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("contextmenu", onCtxMenu);
    el.addEventListener("wheel", onWheel, { passive: false });
    // ⚔️ Esc နဲ့ pointer lock ထွက်သွားရင် ဖိထားပစ်/ADS ကျန်မနေရ
    const onLockChange = () => {
      if (map.id === "arena" && document.pointerLockElement !== el) {
        firing = false;
        setAdsBoth(false);
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);

    // ── Mobile joystick ───────────────────────────────────────────────────
    // DOM element ၂ ခုနဲ့ — React state မသုံးဘူး၊ touch တိုင်း re-render
    // ဖြစ်သွားမှာမို့။
    const stick = mount.querySelector<HTMLElement>("[data-stick]");
    const knob = mount.querySelector<HTMLElement>("[data-knob]");
    let stickId: number | null = null;
    const stickRadius = 46;

    const stickStart = (e: PointerEvent) => {
      sfx?.resume();
      stickId = e.pointerId;
      stick?.setPointerCapture(e.pointerId);
      stickMove(e);
    };
    const stickMove = (e: PointerEvent) => {
      if (stickId !== e.pointerId || !stick) return;
      const rect = stick.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / stickRadius);
      const a = Math.atan2(dy, dx);
      input.jx = Math.cos(a) * d;
      // ★ မျက်နှာပြင်ရဲ့ "အပေါ်" (dy < 0) က ရှေ့သွားတာ ဖြစ်ရမယ်
      input.jz = -Math.sin(a) * d;
      if (knob) {
        knob.style.transform = `translate(${Math.cos(a) * d * stickRadius}px, ${
          Math.sin(a) * d * stickRadius
        }px)`;
      }
    };
    const stickEnd = (e: PointerEvent) => {
      if (stickId !== e.pointerId) return;
      stickId = null;
      input.jx = 0;
      input.jz = 0;
      if (knob) knob.style.transform = "translate(0px, 0px)";
    };
    stick?.addEventListener("pointerdown", stickStart);
    stick?.addEventListener("pointermove", stickMove);
    stick?.addEventListener("pointerup", stickEnd);
    stick?.addEventListener("pointercancel", stickEnd);

    const jumpBtn = mount.querySelector<HTMLElement>("[data-jump]");
    const jumpDown = () => {
      input.jump = true;
    };
    const jumpUp = () => {
      input.jump = false;
    };
    jumpBtn?.addEventListener("pointerdown", jumpDown);
    jumpBtn?.addEventListener("pointerup", jumpUp);
    jumpBtn?.addEventListener("pointercancel", jumpUp);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      // ★ composer ကို မချိန်ရင် window ချဲ့လိုက်တာနဲ့ ပုံက ဆန့်နေမယ်
      postfx.setSize(w, h);
      minimap?.resize();
    };
    window.addEventListener("resize", onResize);

    // ── ကြော်ငြာသင်ပုန်း + တကယ့် live stream ──────────────────────────────
    // ★ ဒါက လောကကို စတင်ဖို့ မလိုအပ်ဘူး — မရလည်း သင်ပုန်းက ဗလာနေရုံပဲ။
    // ဒါကြောင့် await မလုပ်ဘဲ နောက်ကွယ်မှာ ခေါ်တယ်။
    void fetch("/api/metaverse/board", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { posts?: { author: string; text: string }[]; live?: { url: string } | null } | null) => {
        if (killed || !data) return;
        landmarks.setNotices(data.posts ?? []);
        const url = data.live?.url;
        if (url && url !== liveUrl && world.screenMesh) {
          // တကယ် live ရှိရင် env ထဲက default ကို အစားထိုးတယ်
          screen?.dispose();
          screen = attachLiveScreen(world.screenMesh, url);
          liveUrl = url;
        }
      })
      .catch(() => {
        /* သင်ပုန်း ဗလာနေရုံပဲ — လောကက ဆက်လည်တယ် */
      });

    // ── Render loop ───────────────────────────────────────────────────────
    const frameClock = new THREE.Clock();
    let raf = 0;
    let frames = 0;
    let fpsAcc = 0;
    let hudAcc = 0;
    /// ရေလှိုင်း/မီးအတွက် တိုးနေတဲ့ အချိန် (နာရီနဲ့ မဆိုင်ဘူး)
    let effectT = 0;
    let nearId: string | null = null;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // dt ကို ကန့်သတ် — tab ပြန်ဖွင့်ချိန်မှာ dt ကြီးကြီးဝင်လာရင်
      // player က နံရံဖြတ်ပြီး ခုန်ထွက်သွားမယ်။
      const dt = Math.min(frameClock.getDelta(), 0.05);

      // ── input → direction ──────────────────────────────────────────────
      const ix = THREE.MathUtils.clamp(input.r - input.l + input.jx, -1, 1);
      const iz = THREE.MathUtils.clamp(input.f - input.b + input.jz, -1, 1);

      // ★ Camera-relative။ ရှေ့ဘက် F = (sin yaw, cos yaw) — `iz` ကို negate
      // မလုပ်ရ (ကင်မရာက player ရဲ့ နောက်မှာ ရှိလို့ +iz က ကင်မရာနဲ့ဝေးရာ)။
      // ★ ညာဘက်က **F × up = (-cos yaw, sin yaw)** — sign မှားရင် A နဲ့ D
      // လဲနေမယ်။ W ပဲ စမ်းရင် ဒီအမှားကို ဖမ်းမမိဘူး။
      let dirX = Math.sin(cam.yaw) * iz - Math.cos(cam.yaw) * ix;
      let dirZ = Math.cos(cam.yaw) * iz + Math.sin(cam.yaw) * ix;
      const mag = Math.hypot(dirX, dirZ);
      if (mag > 1) {
        dirX /= mag;
        dirZ /= mag;
      }

      const wants = mag > 0.02;
      // ★ CS-style — default ပြေး၊ Shift ဖိရင် လမ်းလျှောက် (နှေး)၊
      //   Ctrl ဖိရင် ကုပ် (အနှေးဆုံး)။
      const running = wants && !input.run && !input.crouch;
      const baseSpeed = input.crouch
        ? CROUCH_SPEED
        : input.run
          ? WALK_SPEED
          : RUN_SPEED;
      // ★ ရေထဲမှာ နှေးတယ် — ဒါက ရေကို ပန်းချီပုံတစ်ခုအဖြစ်ကနေ တကယ့်
      // အတားအဆီးတစ်ခု ဖြစ်စေတယ်။
      const depth = riding ? 0 : world.water.depthAt(p.x, p.z);
      const wade = depth > 0.15 ? 0.5 : 1;
      const speed = wants ? baseSpeed * Math.min(1, mag) * wade : 0;

      // ── ခုန် ───────────────────────────────────────────────────────────
      if (input.jump && !p.airborne) {
        p.vy = JUMP_V;
        p.airborne = true;
      }
      if (p.airborne) {
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
          p.airborne = false;
        }
      }

      // ── ယာဉ် မောင်းနေရင် ─────────────────────────────────────────────
      if (riding) {
        riding.drive(
          dt,
          {
            throttle: iz,
            steer: ix,
            lift: input.jump ? 1 : input.run ? -1 : 0,
            brake: input.b > 0 && Math.abs(riding.state.speed) < 0.6,
            boost: input.run && !riding.spec.flying,
          },
          world.colliders,
          world.walkRadius,
          (wx, wz) => world.water.isInside(wx, wz),
        );
        // player က ယာဉ်နဲ့အတူ ရွှေ့တယ် — တခြားသူတွေ မြင်ရဖို့
        p.x = riding.state.x;
        p.y = riding.state.y;
        p.z = riding.state.z;
        p.ry = riding.state.ry;
        net?.sendVehicleState(riding.id, riding.state);
      }

      // ── ရွှေ့ + collision ──────────────────────────────────────────────
      if (!riding && speed > 0) {
        const nx = p.x + dirX * speed * dt;
        const nz = p.z + dirZ * speed * dt;
        const solved = resolveCollision(nx, nz, p.x, p.z, world.colliders, world.walkRadius);
        p.x = solved.x;
        p.z = solved.z;
      }
      // ── မျက်နှာမူရာ — ရုတ်တရက်မလှည့်ဘဲ ချောချောလှည့် ──────────────────
      // ★ First-person မှာ CS လိုပဲ **ကင်မရာဘက်ကို အမြဲ** မျက်နှာမူတယ် —
      //   A/D က strafe (ဘေးတိုး) ဖြစ်ပြီး ကိုယ်လုံးက မလှည့်ဘူး။ ဒါမှ
      //   တခြားသူတွေနဲ့ voice listener က မှန်တဲ့ ဦးတည်ရာ ရတယ်။
      if (!riding) {
        const targetRy = fpvRef.current
          ? cam.yaw
          : speed > 0
            ? Math.atan2(dirX, dirZ)
            : p.ry;
        let diff = targetRy - p.ry;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.ry += diff * Math.min(1, (fpvRef.current ? 20 : 14) * dt);
      }

      // ── ကုပ် — camera နိမ့် + avatar ပုလိုက် (ချောချော ကူးပြောင်း) ──────
      const crouchTarget = input.crouch && !riding ? 1 : 0;
      crouchLerp += (crouchTarget - crouchLerp) * Math.min(1, 10 * dt);
      me.group.scale.y = 1 - 0.28 * crouchLerp;

      me.group.position.set(p.x, p.y, p.z);
      me.group.rotation.y = p.ry;
      me.update(dt, {
        speed,
        running,
        airborne: p.airborne,
        emote: emoteRef.current,
      });

      // ── တခြား player တွေ ───────────────────────────────────────────────
      for (const r of remotes.values()) {
        const dx = r.target.x - r.cur.x;
        const dz = r.target.z - r.cur.z;
        const dist = Math.hypot(dx, dz);
        // ရွှေ့နှုန်းကနေ လမ်းလျှောက်/ပြေး animation ကို ခန့်မှန်းတယ် —
        // server က speed မပို့ဘူး၊ ပို့ရင် packet ကြီးလာမယ်။
        r.speed = dist > 0.02 ? Math.min(RUN_SPEED, dist / Math.max(dt, 0.016)) : 0;
        const k = Math.min(1, 12 * dt);
        r.cur.x += dx * k;
        r.cur.z += dz * k;
        r.cur.y += (r.target.y - r.cur.y) * k;
        let dry = r.target.ry - r.cur.ry;
        while (dry > Math.PI) dry -= Math.PI * 2;
        while (dry < -Math.PI) dry += Math.PI * 2;
        r.cur.ry += dry * k;

        r.avatar.group.position.set(r.cur.x, r.cur.y, r.cur.z);
        r.avatar.group.rotation.y = r.cur.ry;

        // ── LOD + cull (spec 6.1) ────────────────────────────────────────
        // ★ နေရာကို အပေါ်မှာ တွက်ပြီးပြီ — animation ကိုပဲ ချန်တယ်။ နေရာပါ
        // ရပ်ရင် ၄၅ ကျော် ဝေးရာက ပြန်နီးလာချိန်မှာ ခုန်သွားမယ်။
        const far = Math.hypot(r.cur.x - p.x, r.cur.z - p.z);
        r.avatar.group.visible = far < CULL_BEYOND;
        if (far < LOD_ANIMATE_WITHIN) {
          r.avatar.update(dt, {
            speed: r.speed,
            running: r.speed > 5,
            airborne: r.cur.y > 0.15,
            emote: r.emote,
          });
        }
      }

      net?.sendUpdate(p.x, p.y, p.z, p.ry);
      // ⚔️ Combat position — server ရဲ့ anti-cheat (applyMove) အတွက် 10Hz။
      // Presence (update) နဲ့ တန်ဖိုးတူတူပဲ — layer ၂ ခုက ကိန်းတစ်စုံတည်း။
      if (roomId === "arena") {
        const nowMs = Date.now();
        if (nowMs - lastAMoveAt > 100) {
          lastAMoveAt = nowMs;
          net?.sendRaw({ type: "aMove", x: p.x, y: p.y, z: p.z, ry: p.ry });
        }
      }

      // ── ခြေသံ ──────────────────────────────────────────────────────────
      audio.move("me", p.x, p.y, p.z, speed, dt, p.airborne);
      for (const [id, r] of remotes) {
        audio.move(id, r.cur.x, r.cur.y, r.cur.z, r.speed, dt, r.cur.y > 0.15);
      }

      // ── အနားက ယာဉ် ─────────────────────────────────────────────────────
      if (!riding) {
        let best: Vehicle | null = null;
        let bestD = 2.5;
        for (const v of vehicles.values()) {
          const d = Math.hypot(v.state.x - p.x, v.state.z - p.z);
          if (d < bestD && !v.driver) {
            best = v;
            bestD = d;
          }
        }
        if (best !== nearVeh) {
          nearVeh = best;
          setRide(best ? { label: best.spec.label, riding: false } : null);
        }
      }

      // ── ကင်မရာ ─────────────────────────────────────────────────────────
      const cp = Math.cos(cam.pitch);
      if (fpvRef.current && !riding) {
        // ── First-person — မျက်လုံးအမြင့် (~1.55) ကနေ ရှေ့ကို ကြည့်တယ်။
        // ★ ကိုယ့် avatar ကို ဖျောက်ရတယ် — မဖျောက်ရင် ခေါင်းတွင်းက
        //   geometry တွေ မျက်နှာပြင်ပေါ် ကျလာတယ်။
        const eyeY = p.y + 1.55 - 0.55 * crouchLerp;
        camera.position.set(p.x, eyeY, p.z);
        camera.lookAt(
          p.x + Math.sin(cam.yaw) * cp,
          eyeY - Math.sin(cam.pitch),
          p.z + Math.cos(cam.yaw) * cp,
        );
      } else {
        // ယာဉ်ကြီးလေ ကင်မရာ ဝေးလေ — မဟုတ်ရင် ယာဉ်က မျက်နှာပြင် ဖုံးမယ်
        const dist = riding ? riding.spec.camDist : cam.dist;
        camera.position.set(
          p.x - Math.sin(cam.yaw) * cp * dist,
          p.y + 1.5 + Math.sin(cam.pitch) * dist,
          p.z - Math.cos(cam.yaw) * cp * dist,
        );
        camera.lookAt(p.x, p.y + 1.1, p.z);
      }
      // Frame တိုင်း တွက်တယ် — စီးနေရင်လည်း ဖျောက် (toggleRide နဲ့ တူညီ)
      me.group.visible = !riding && !fpvRef.current;

      // ── ⚔️ Auto-fire + ADS zoom + ကင်မရာ တုန်ခါမှု ─────────────────────
      if (map.id === "arena") {
        // ဖိထားရင် fireMs နှုန်းအတိုင်း ဆက်ပစ် (cooldown က fireOnce ထဲမှာ)
        if (firing) arenaFireRef.current?.();
        const targetFov = adsRef.current ? ADS_FOV[combat.weapon] ?? 45 : BASE_FOV;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * Math.min(1, 10 * dt);
          camera.updateProjectionMatrix();
        }
      }
      if (shake > 0.004) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake * 0.6;
        camera.position.z += (Math.random() - 0.5) * shake;
        shake *= Math.exp(-6 * dt);
      } else {
        shake = 0;
      }

      // နားထောင်သူက ကင်မရာ — လှည့်တာနဲ့ အသံရဲ့ ဘယ်/ညာ ပြောင်းရမယ်
      audio.syncListener(camera);

      // ── နေ့/ည (server နာရီနဲ့ တူညီ) ────────────────────────────────────
      const worldTime = worldTimeNow();
      const daylight = world.updateSky(worldTime);

      // ── Bloom ──────────────────────────────────────────────────────────
      // ★ လျှော့ချထားရင် လူရဲ့ ရွေးချယ်မှုကို မဖျက်ဘဲ ပိတ်ထားတယ် —
      // စက်ကောင်းတဲ့ဖုန်းနဲ့ နောက်တစ်ခါဝင်ရင် သူ့ရွေးချယ်မှု ပြန်ရမယ်။
      postfx.enabled = bloomRef.current && !degradedRef.current;
      postfx.setDaylight(daylight);
      // ── ရေ / မီး / ရာသီဥတု ─────────────────────────────────────────────
      effectT += dt;
      world.updateEffects(dt, effectT, weather.wetness, p.x, p.z);
      weather.update(dt, p.x, p.y + 6, p.z);
      gameFx.update(effectT);
      combatFx?.update(dt);

      // ── ဆောက်လုပ်ရေး: ghost + ကွက် streaming (Phase 18) ────────────────
      plots.update(p.x, p.z);

      // Voice — နားထောင်သူနဲ့ ပြောသူတွေရဲ့ နေရာ sync (spatial audio)
      if (voiceChat.active) {
        const positions = new Map<string, { x: number; y: number; z: number }>();
        for (const [id, r] of remotes) positions.set(id, r.cur);
        voiceChat.update({ x: p.x, y: p.y, z: p.z, ry: p.ry }, positions);
      }
      if (ghostType) {
        // ★ Player ရဲ့ ရှေ့ ၃ unit — raycast မလုပ်ဘူး၊ ဖုန်းမှာ
        // "ဘယ်ကို ထောက်ရမလဲ" ဆိုတာ ခက်တယ်။ ရှေ့ကို ကြည့်ပြီး ချတာက
        // touch မှာလည်း အလုပ်လုပ်တယ်။
        ghostAt.x = snap(p.x + Math.sin(p.ry) * 3);
        ghostAt.z = snap(p.z + Math.cos(p.ry) * 3);
        ghostAt.y = 0;
        ghost.show(ghostType, ghostAt.x, ghostAt.y, ghostAt.z, ghostRy, ghostValid);
      } else {
        ghost.hide();
      }
      for (const v of vehicles.values()) {
        if (v !== riding) v.follow(dt);
        v.animate(dt);
      }

      screen?.update(p.x, p.z);
      // ★ ဝေးတဲ့အခန်းထဲက ပရိဘောဂတွေကို ဖျောက် — အခန်း ၁၉ ခုစလုံး
      // အမြဲဆွဲနေရင် ဖုန်းအဟောင်းမှာ မတင်ဘူး
      world.updateInteriors(p.x, p.z);
      minimap?.draw(p, remoteViews());
      nametags?.update(camera, mount.clientWidth, mount.clientHeight, taggable());
      postfx.render();

      // ── Adaptive quality ───────────────────────────────────────────────
      // ★ ဖုန်းအဟောင်းက ခလုတ်ရှာပြီး ပိတ်မယ့်အထိ မစောင့်ဘူး — အဲဒီအချိန်မှာ
      // tab ကို ပိတ်လိုက်ပြီ ဖြစ်တယ်။
      if (quality.sample(dt)) {
        degradedRef.current = true;
        renderer.setPixelRatio(1);
        postfx.setSize(mount.clientWidth, mount.clientHeight);
        applyShadows(false);
        setDegraded(true);
      }

      // FPS — ၂ စက္ကန့်တစ်ခါသာ state ထဲတင် (re-render နည်းအောင်)
      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 2) {
        setFps(Math.round(frames / fpsAcc));
        frames = 0;
        fpsAcc = 0;
      }

      // ── HUD — ၄ ကြိမ်/စက္ကန့် ────────────────────────────────────────────
      // ★ နာရီနဲ့ landmark ကို frame တိုင်း setState လုပ်ရင် တစ်စက္ကန့်
      // re-render ၆၀ ခါ ဖြစ်ပြီး performance စည်းမျဉ်းကို ချိုးဖောက်မယ်။
      hudAcc += dt;
      if (hudAcc >= 0.25) {
        hudAcc = 0;
        const mins = Math.floor(worldTime * 24 * 60);
        setClock(
          `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
        );
        const near = landmarks.nearest(p.x, p.z);
        if ((near?.id ?? null) !== nearId) {
          nearId = near?.id ?? null;
          setNearby(near);
        }
      }
    };

    /// Minimap က နေရာပဲ လိုတယ် — avatar object တစ်ခုလုံး ပေးစရာမလိုဘူး
    function* remoteViews() {
      for (const r of remotes.values()) yield r.cur;
    }

    /// နာမည်တံဆိပ်တွေ — ကိုယ့်ကိုယ်ကို မပါဘူး (ကိုယ့်နာမည်က HUD မှာ ရှိပြီးသား)
    function* taggable() {
      for (const [id, r] of remotes) {
        yield { id, x: r.cur.x, y: r.cur.y, z: r.cur.z };
      }
    }

    // ── Background သွားရင် render ရပ် (Phase 17.4) ────────────────────────
    // ★ ဒါက **မဖြစ်မနေ**။ မလုပ်ရင် tab/app ကို နောက်ပိုင်း ပို့လိုက်တဲ့အခါ
    //   60fps နဲ့ ဆက်ဆွဲနေပြီး ဖုန်း ပူပြီး ဘက်ထရီ ကုန်တယ် — app ဖျက်ရတဲ့
    //   အကြောင်းရင်း အဖြစ်များဆုံးပါ။
    // ★ `afk` ကို server ဆီ ပြောတယ် — server က အဲဒီလူဆီ position update
    //   တွေ ပို့မနေတော့ဘူး (ဖုန်း data ရော ဘက်ထရီရော ချွေတယ်)。
    let hidden = false;
    const onVisibility = () => {
      if (killed) return;
      if (document.hidden) {
        if (hidden) return;
        hidden = true;
        cancelAnimationFrame(raf);
        raf = 0;
        net?.sendAfk(true);
        native.setKeepAwake(false);
      } else {
        if (!hidden) return;
        hidden = false;
        // ★ Clock ကို reset — မလုပ်ရင် ပြန်လာချိန်မှာ dt က မိနစ်ချီ
        // ဖြစ်ပြီး player က လောကတစ်ဖက်ကို ခုန်ထွက်သွားမယ်။
        frameClock.getDelta();
        net?.sendAfk(false);
        native.setKeepAwake(true);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    setReady(true);
    // ★ App ကို "ပြီးပြီ" လို့ ပြောတယ် — splash ဖျောက်ပြီး ဖန်သားပြင်ကို
    // ဖွင့်ထားခိုင်းတယ်။ Browser မှာ ဒါတွေက ဘာမှမလုပ်ဘူး။
    native.ready();
    native.setKeepAwake(true);
    tick();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      killed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      // ★ ထွက်တာနဲ့ wakelock ပြန်ဖြုတ်ရမယ် — မဖြုတ်ရင် metaverse ကထွက်ပြီး
      // တောင် ဖန်သားပြင်က ဘယ်တော့မှ မပိတ်တော့ဘူး။
      native.setKeepAwake(false);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onLockChange);
      el.removeEventListener("contextmenu", onCtxMenu);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      // Map ပြောင်း/ထွက်ချိန် pointer lock ကျန်မနေစေနဲ့
      if (document.pointerLockElement === el) document.exitPointerLock();
      stick?.removeEventListener("pointerdown", stickStart);
      stick?.removeEventListener("pointermove", stickMove);
      stick?.removeEventListener("pointerup", stickEnd);
      stick?.removeEventListener("pointercancel", stickEnd);
      jumpBtn?.removeEventListener("pointerdown", jumpDown);
      jumpBtn?.removeEventListener("pointerup", jumpUp);
      jumpBtn?.removeEventListener("pointercancel", jumpUp);
      net?.close();
      netRef.current = null;
      gameActionRef.current = null;
      for (const r of remotes.values()) r.avatar.dispose();
      remotes.clear();
      me.dispose();
      // ★ screen က fetch ပြီးမှ အစားထိုးခံရနိုင်လို့ holder ကနေ dispose လုပ်တယ်
      screen?.dispose();
      minimap?.dispose();
      nametags?.dispose();
      weather.dispose();
      gameFx.dispose();
      combatFx?.dispose();
      sfx?.dispose();
      buildRender.dispose();
      plots.dispose();
      ghost.dispose();
      buildRef.current = null;
      voiceChat.dispose();
      voiceRef.current = null;
      for (const v of vehicles.values()) {
        scene.remove(v.group);
        v.dispose();
      }
      vehicles.clear();
      rideRef.current = null;
      shadowRef.current = null;
      restoreRef.current = null;
      landmarks.dispose();
      audio.dispose();
      audioRef.current = null;
      postfx.dispose();
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (el.parentNode === mount) mount.removeChild(el);
    };
    // ★ roomId ပြောင်းရင် အားလုံး ပြန်ဆောက်တယ် — cleanup က renderer,
    // geometry, material, socket အကုန် ရှင်းပြီးမှ အသစ် စတယ်။
    // (setAdsBoth က useCallback([]) မို့ တည်ငြိမ်တယ်)
  }, [roomId, avatarNonce, setAdsBoth]);

  return (
    <div ref={mountRef} className="relative h-full w-full">
      {/* နာမည်တံဆိပ်တွေ ကပ်တဲ့နေရာ — 3D မဟုတ်ဘဲ DOM (nametags.ts) */}
      <div
        ref={tagsRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      />

      {/* ── ⚔️ Arena combat HUD — game room မှာသာ။ Social room တွေမှာ ဒီ
          layer လုံးဝ မရှိဘူး (server ကလည်း combat message ငြင်းတယ်)။ */}
      {roomId === "arena" && arenaHud.denied ? (
        <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-white/90">
            ⚔️ ပွဲကွင်းက ၁၈+ သာ ဝင်လို့ရပါတယ် — အကောင့်ဝင်ပြီး
            အသက်အတည်ပြုထားဖို့ လိုပါတယ်။
          </p>
          <button
            data-hud="1"
            onClick={() => chooseMap("city")}
            className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            🏙 မြို့တော်ကို ပြန်သွားမယ်
          </button>
        </div>
      ) : null}
      {roomId === "arena" && !arenaHud.denied ? (
        <>
          {/* Crosshair + ထိမှတ် ✕ — ထိမှန်တိုင်း ခဏပေါ်တယ် (ခေါင်း=အနီ) */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 select-none text-2xl text-white/70">
            +
          </div>
          {hitMark ? (
            <div
              key={hitMark.at}
              className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 select-none text-3xl font-bold ${
                hitMark.head ? "text-red-400" : "text-amber-300"
              }`}
            >
              ✕
            </div>
          ) : null}
          {/* 🎯 Sniper scope — ADS ချိန်မှာ မှန်ဘီလူးဝိုင်း + ချိန်မျဉ်း */}
          {ads && arenaHud.you?.weapon === "sniper" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[9]"
              style={{
                background:
                  "radial-gradient(circle at center, transparent 0 34vmin, rgba(0,0,0,0.96) 35vmin 100%)",
              }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/50" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/50" />
            </div>
          ) : null}
          {/* ဒဏ်ရာဂဏန်းများ — ထိတိုင်း "-34" crosshair ဘေး ပေါ်တယ် */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -mt-3 ml-7 flex flex-col items-start">
            {dmgNums.map((n) => (
              <span
                key={n.id}
                className={`text-sm font-bold drop-shadow ${
                  n.head ? "text-red-400" : "text-amber-300"
                }`}
              >
                {n.text}
              </span>
            ))}
          </div>
          {/* အထိခံရဦးတည်ရာ — ပစ်သူဘက် ညွှန်တဲ့ အနီမြှား (PUBG-style) */}
          {hurtFrom ? (
            <div
              key={hurtFrom.at}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-44 w-44"
              style={{ transform: `translate(-50%,-50%) rotate(${hurtFrom.deg}deg)` }}
            >
              <div className="absolute left-1/2 top-0 -translate-x-1/2 text-2xl text-red-500/90 drop-shadow">
                ▲
              </div>
            </div>
          ) : null}
          {/* အထိခံရချိန် အနီ vignette — မျက်နှာပြင်အနားတွေ ခဏနီသွားတယ် */}
          <div
            className={`pointer-events-none absolute inset-0 z-[8] transition-opacity duration-300 ${
              dmgOn ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(220,38,38,0.5) 100%)",
            }}
          />
          {/* ★ ပစ်မှတ် + လက်နက်တန်း — **အပေါ်ဗဟို**။ အရင်က အောက်ဗဟိုမှာ
              pointer-events-auto container ကြီးက joystick ကို ဖုံးထားလို့
              ဖုန်းမှာ လမ်းလျှောက်လို့ မရဘူး — container က pointer-events-none၊
              ခလုတ်တစ်ခုချင်းပဲ auto။ */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {arenaHud.you?.target ? (
              <p className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-amber-300 backdrop-blur">
                🎯 ပစ်မှတ် — {arenaHud.you.target.name}
              </p>
            ) : null}
            <div className="flex max-w-[92vw] flex-wrap items-center justify-center gap-1.5">
              {Object.entries(arenaHud.weapons).map(([key, w], i) => (
                <button
                  key={key}
                  data-hud="1"
                  onClick={() => arenaWeaponPickRef.current?.(key)}
                  className={`pointer-events-auto rounded-lg border px-2 py-1 text-[11px] backdrop-blur ${
                    arenaHud.you?.weapon === key
                      ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                      : "border-white/15 bg-black/50 text-white/70 hover:bg-black/70"
                  }`}
                >
                  {i < 7 ? `${i + 1}·` : ""}
                  {w.my}
                </button>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute right-2 top-20 z-10 w-60 space-y-1">
            {arenaHud.feed.map((f) => (
              <p
                key={`${f.at}-${f.text}`}
                className={`rounded bg-black/55 px-2 py-1 text-[11px] backdrop-blur ${
                  f.good ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {f.text}
              </p>
            ))}
          </div>
          {/* ❤️ / ကျည် — ဖတ်ရုံသက်သက် (အောက်ဗဟို၊ emote bar နေရာ) */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            <span className="rounded bg-black/60 px-2.5 py-1 text-sm text-red-300 backdrop-blur">
              ❤️ {arenaHud.you?.hp ?? "—"}
            </span>
            <span className="rounded bg-black/60 px-2.5 py-1 text-sm text-white/80 backdrop-blur">
              {(() => {
                const y = arenaHud.you;
                if (!y) return "—";
                const n = y.ammo?.[y.weapon];
                const label = arenaHud.weapons[y.weapon]?.my ?? y.weapon;
                return `${label} · ${n === -1 || n === undefined ? "∞" : n}`;
              })()}
            </span>
          </div>
          {/* ★ လုပ်ဆောင်ချက်တန်း — ညာဘက် (ခုန်ခလုတ်အပေါ်)၊ လက်မနဲ့ မီတယ်။
              Joystick (ဘယ်) နဲ့ လုံးဝ မထပ်ဘူး။ */}
          <div className="pointer-events-none absolute bottom-32 right-4 z-10 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                data-hud="1"
                onClick={() => setShowBoard((s) => !s)}
                aria-label="အမှတ်စာရင်း"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm backdrop-blur"
              >
                🏆
              </button>
              <button
                data-hud="1"
                onClick={invite}
                aria-label="အဖွဲ့ဖိတ်မယ်"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm backdrop-blur"
              >
                📣
              </button>
              <button
                data-hud="1"
                onClick={() => chooseMap("city")}
                className="pointer-events-auto rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] text-white/70 backdrop-blur hover:bg-black/70"
              >
                🏙 ထွက်မယ်
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                data-hud="1"
                onClick={() => {
                  setCrouchOn((c) => {
                    crouchSetRef.current?.(!c);
                    return !c;
                  });
                }}
                aria-label="ကုပ်မယ်"
                className={`pointer-events-auto rounded-full border px-3 py-2 text-sm backdrop-blur ${
                  crouchOn
                    ? "border-emerald-400/70 bg-emerald-500/30 text-emerald-200"
                    : "border-white/20 bg-black/50 text-white/80"
                }`}
              >
                🧎
              </button>
              <button
                data-hud="1"
                onClick={() => arenaReloadRef.current?.()}
                aria-label="ကျည်ဖြည့်မယ် (R)"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white/80 backdrop-blur"
              >
                🔄
              </button>
              <button
                data-hud="1"
                onClick={() => setAdsBoth(!ads)}
                aria-label="ချိန်ကွင်း (ADS)"
                className={`pointer-events-auto rounded-full border px-3 py-2 text-sm backdrop-blur ${
                  ads
                    ? "border-amber-400/70 bg-amber-500/30 text-amber-200"
                    : "border-white/20 bg-black/50 text-white/80"
                }`}
              >
                🎯
              </button>
            </div>
            {/* 🔫 ဖိထား = ဆက်ပစ် — SMG အတွက် မဖြစ်မနေ (နှုန်းက server fireMs) */}
            <button
              data-hud="1"
              onPointerDown={() => arenaFireHoldRef.current?.(true)}
              onPointerUp={() => arenaFireHoldRef.current?.(false)}
              onPointerLeave={() => arenaFireHoldRef.current?.(false)}
              onPointerCancel={() => arenaFireHoldRef.current?.(false)}
              aria-label="ပစ်မယ် (ဖိထားရင် ဆက်ပစ်)"
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/70 bg-red-500/30 text-2xl backdrop-blur active:scale-95 active:bg-red-500/60"
            >
              🔫
            </button>
          </div>
          {arenaHud.you && !arenaHud.you.alive ? (
            <p className="pointer-events-none absolute left-1/2 top-[42%] z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/70 px-4 py-2 text-sm text-red-300 backdrop-blur">
              ☠️ သေဆုံးပြီ — ပြန်ရှင်ဖို့ ခဏစောင့်ပါ…
            </p>
          ) : null}
        </>
      ) : null}

      {/* ── 🙈 ဝှက်တမ်း HUD — hide-1 room မှာသာ ── */}
      {roomId === "hide-1" ? (
        <>
          {/* Seeker ရဲ့ မျက်စိမှိတ်ချိန် — မှောင်ပြီး countdown ပြတယ် */}
          {hideHud.role === "seeker" &&
          hideHud.blindUntil &&
          hideHud.blindUntil > nowSec ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/90">
              <p className="text-3xl">🙈</p>
              <p className="text-sm text-white/90">
                မျက်စိမှိတ်ထားပါ… {Math.max(0, Math.ceil((hideHud.blindUntil - nowSec) / 1000))} စက္ကန့်
              </p>
              <p className="text-xs text-white/50">ပုန်းသူတွေ ပုန်းနေကြပြီ</p>
            </div>
          ) : null}

          <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
            <p className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur">
              {hideHud.phase === "waiting"
                ? `🙈 ဝှက်တမ်း — ကစားသမား ${hideHud.players.length} ယောက် (၃ ယောက်ပြည့်ရင် စမယ်)`
                : hideHud.phase === "countdown"
                  ? `⏳ စတော့မယ်… ${hideHud.endsAt ? Math.max(0, Math.ceil((hideHud.endsAt - nowSec) / 1000)) : ""} စက္ကန့်`
                  : hideHud.phase === "live"
                    ? `⏱ ${hideHud.endsAt ? Math.max(0, Math.floor((hideHud.endsAt - nowSec) / 60000)) + ":" + String(Math.max(0, Math.floor(((hideHud.endsAt - nowSec) % 60000) / 1000))).padStart(2, "0") : ""} ကျန်သေး`
                    : "🏁 ပွဲပြီးပါပြီ — ခဏနေ ပြန်စမယ်"}
            </p>
            {hideHud.phase === "live" && hideHud.role ? (
              <p
                className={`rounded-full px-3 py-1 text-[11px] backdrop-blur ${
                  hideHud.role === "seeker"
                    ? "bg-amber-500/25 text-amber-200"
                    : "bg-emerald-500/25 text-emerald-200"
                }`}
              >
                {hideHud.role === "seeker" ? "🔦 မင်းက ရှာဖွေသူ" : "🙈 ပုန်းပါ — အဖမ်းမခံနဲ့"}
              </p>
            ) : null}
          </div>

          <div className="pointer-events-none absolute right-2 top-20 z-10 w-60 space-y-1">
            {hideHud.feed.map((f) => (
              <p
                key={`${f.at}-${f.text}`}
                className={`rounded bg-black/55 px-2 py-1 text-[11px] backdrop-blur ${
                  f.good ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {f.text}
              </p>
            ))}
          </div>

          {/* ★ ခလုတ်တွေ ညာဘက် (ခုန်ခလုတ်အပေါ်) — အောက်ဗဟိုမှာ ထားရင်
              ကျဉ်းတဲ့ဖုန်းမှာ joystick နဲ့ ထပ်ပြီး လမ်းလျှောက်လို့ မရဘူး။ */}
          <div className="pointer-events-none absolute bottom-32 right-4 z-10 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                data-hud="1"
                onClick={() => setShowBoard((s) => !s)}
                aria-label="အမှတ်စာရင်း"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm backdrop-blur"
              >
                🏆
              </button>
              <button
                data-hud="1"
                onClick={invite}
                aria-label="အဖွဲ့ဖိတ်မယ်"
                className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm backdrop-blur"
              >
                📣
              </button>
              <button
                data-hud="1"
                onClick={() => chooseMap("city")}
                className="pointer-events-auto rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] text-white/70 backdrop-blur hover:bg-black/70"
              >
                🏙 ထွက်မယ်
              </button>
            </div>
            {hideHud.role === "seeker" && hideHud.phase === "live" ? (
              <button
                data-hud="1"
                onClick={() => hideTagRef.current?.()}
                className="pointer-events-auto rounded-full border-2 border-amber-400/70 bg-amber-500/30 px-6 py-4 text-xl backdrop-blur active:scale-95 active:bg-amber-500/60"
              >
                🖐 ဖမ်းမယ်
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/* ── ⚔️🙈 မျှသုံး game UI — ကြေညာစာတန်း / အမှတ်စာရင်း / ဖိတ်စာ toast ── */}
      {banner ? (
        <p
          key={banner.at}
          className={`pointer-events-none absolute left-1/2 top-[30%] z-20 -translate-x-1/2 whitespace-nowrap rounded-xl bg-black/65 px-5 py-2 text-base font-bold backdrop-blur ${
            banner.tone === "good" ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {banner.text}
        </p>
      ) : null}
      {showBoard && (roomId === "arena" || roomId === "hide-1") ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-72 max-w-[88vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/80 p-3 backdrop-blur">
          <p className="mb-2 text-center text-xs font-semibold text-white/90">
            🏆 အမှတ်စာရင်း
          </p>
          <div className="space-y-1">
            {(roomId === "arena"
              ? [...arenaHud.board]
                  .sort((a, b) => b.score - a.score)
                  .map((r) => ({ id: r.id, name: r.name, score: r.score, dead: !r.alive }))
              : [...hideHud.players]
                  .sort((a, b) => b.score - a.score)
                  .map((r) => ({ id: r.id, name: r.name, score: r.score, dead: false }))
            ).map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center justify-between rounded px-2 py-1 text-[12px] ${
                  r.id === meId ? "bg-emerald-500/15 text-emerald-200" : "text-white/85"
                }`}
              >
                <span className="truncate">
                  {i + 1}. {r.name}
                  {r.id === meId ? " (မင်း)" : ""}
                  {r.dead ? " ☠️" : ""}
                </span>
                <span className="font-semibold">{r.score}</span>
              </div>
            ))}
            {(roomId === "arena" ? arenaHud.board : hideHud.players).length === 0 ? (
              <p className="text-center text-[11px] text-white/50">
                ကစားသမား မရှိသေးဘူး
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {invited ? (
        <p className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600/85 px-4 py-1.5 text-xs text-white backdrop-blur">
          📣 ဖိတ်စာ link ကူးပြီးပြီ — သူငယ်ချင်းတွေကို ပို့လိုက်ပါ
        </p>
      ) : null}

      {/* ── Gwave branded loading — world/game အဝင်တိုင်း logo + စာတန်း ── */}
      {!booted && link !== "auth" ? (
        <BrandedLoading
          title={`${getMap(roomId).emoji} ${getMap(roomId).name} ထဲ ဝင်နေသည်…`}
          subtitle="Gwave Metaverse"
        />
      ) : null}

      {/* ── HUD ဘယ်ဘက်တန်း ──────────────────────────────────────────────
          ★ Flow layout — အရင်က ခလုတ်တွေကို absolute top-24/36/48/60 နဲ့
            တစ်ခုချင်း ချထားလို့ panel ဖွင့်တိုင်း အောက်က ခလုတ်တွေနဲ့
            ထပ်နေတယ် (landscape viewport နိမ့်ရင် ပိုဆိုးတယ်)။ အခုက
            accordion — panel က ကိုယ့်ခလုတ်အောက်မှာ ပွင့်ပြီး ကျန်တာတွေ
            အောက်ရွေ့တယ်၊ မဆံ့ရင် တန်းက scroll ဖြစ်တယ် (bottom-40 က
            joystick/chat ဧရိယာ မထိအောင်)။ */}
      <div className="pointer-events-none absolute bottom-40 left-3 top-3 z-20 flex flex-col items-start gap-2">
      <div className="shrink-0 select-none rounded-lg bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-white/80 backdrop-blur">
        <div className="font-semibold text-emerald-300">Gwave Metaverse</div>
        {!touch && (
          <>
            <div>WASD ရွှေ့ · Shift လျှောက် · Ctrl ကုပ် · Space ခုန်</div>
            <div>V မြင်ကွင်း · မောက်စ်ဆွဲ = ကင်မရာ · scroll = zoom</div>
            {fpv && <div className="text-emerald-300/80">FP: click = ကြည့်ရှုထိန်း · Esc = လွှတ်</div>}
          </>
        )}
        {touch && <div>ဘယ်ဘက် joystick · ညာဘက် ခုန်</div>}
        {/* ⚔️ Game room ခလုတ်လမ်းညွှန် — desktop မှာ keyboard, ဖုန်းမှာ ခလုတ် */}
        {roomId === "arena" && (
          <div className="text-amber-200/90">
            {touch ? (
              "🔫 ဖိထား = ဆက်ပစ် · 🎯 ချိန်ကွင်း · 🧎 ကုပ် · 🔄 ကျည် · 🏆 အမှတ် · 📣 ဖိတ်"
            ) : (
              <>
                <div>Click ဖိထား = ဆက်ပစ် · Right-click = 🎯 ချိန်ကွင်း</div>
                <div>R = ကျည်ဖြည့် · 1-7 / လှိမ့် = လက်နက် · Q = အရင်လက်နက်</div>
                <div>Ctrl = ကုပ် · Shift = လျှောက် · Tab = အမှတ်စာရင်း</div>
              </>
            )}
          </div>
        )}
        {roomId === "hide-1" && (
          <div className="text-amber-200/90">
            {touch ? "🖐 ဖမ်း · 🏆 အမှတ် · 📣 ဖိတ်" : "🖐 = ဖမ်း · Tab = အမှတ်စာရင်း"}
          </div>
        )}
        {ready && (
          <div className="mt-1 flex items-center gap-2 text-white/50">
            <span>{fps} fps</span>
            {clock && (
              <>
                <span>·</span>
                {/* Server နာရီကနေ တွက်ထားလို့ player တိုင်း တူညီတယ် */}
                <span title="လောကထဲက အချိန်">🕐 {clock}</span>
              </>
            )}
            <span>·</span>
            <span
              className={
                link === "live"
                  ? "text-emerald-400"
                  : link === "auth"
                    ? "text-amber-400"
                    : "text-white/40"
              }
            >
              {link === "live"
                ? `👥 ${online}`
                : link === "connecting"
                  ? "ချိတ်နေသည်…"
                  : link === "auth"
                    ? "login လိုသည်"
                    : "တစ်ယောက်တည်း"}
            </span>
          </div>
        )}

        {/* ── ကိုယ်ဘယ်သူလဲ ───────────────────────────────────────────── */}
        {link === "live" && (
          <div className="pointer-events-auto mt-1 flex items-center gap-1.5">
            {meAuthed ? (
              <span className="text-emerald-300">👤 {meName}</span>
            ) : (
              <>
                {/* ဧည့်သည်က နာမည်ကို ကိုယ်တိုင်ပေးလို့ရတယ်။ Server က
                    authed=false ကို အမြဲတွဲပို့လို့ Gwave အကောင့်ရှိသူတစ်ယောက်
                    အဖြစ် ဟန်ဆောင်လို့ မရဘူး။ */}
                <input
                  data-hud="1"
                  value={meName}
                  onChange={(e) => setMeName(e.target.value.slice(0, 24))}
                  onBlur={() => netRef.current?.sendName(meName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      netRef.current?.sendName(meName);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  maxLength={24}
                  aria-label="ဧည့်သည် နာမည်"
                  className="w-28 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-emerald-400/60"
                />
                <span className="rounded bg-white/15 px-1 text-[9px] text-white/60">
                  ဧည့်သည်
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Accordion — 🌍 / 🎮 / 🏗 / 🎙 ခလုတ်တန်း။ Panel က ကိုယ့်ခလုတ်
          အောက်မှာ ပွင့်တယ်၊ တစ်ခုတည်းသာ ပွင့်ခွင့်ရှိတယ် (menu state)။ */}
      <div className="pointer-events-auto flex min-h-0 flex-col items-start gap-1.5 overflow-y-auto overscroll-contain pr-1">
        {/* ── 🌍 Map ရွေးချယ်မှု — map တစ်ခုချင်းက server ဘက်မှာ သီးခြား
            room မို့ တစ်ခုထဲက လူတွေက ကျန်တဲ့ map ကလူတွေကို မမြင်ရဘူး။ */}
        <button
          data-hud="1"
          onClick={() => setMenu((m) => (m === "map" ? null : "map"))}
          title="လောကရွေးရန်"
          className={`rounded-lg border bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur hover:bg-black/70 ${
            menu === "map" ? "border-emerald-400/60" : "border-white/15"
          }`}
        >
          🌍 {getMap(roomId).emoji} {getMap(roomId).name}
        </button>
        {menu === "map" && (
          <div
            data-hud="1"
            className="w-[min(20rem,80vw)] space-y-1.5 rounded-xl border border-white/15 bg-black/70 p-2 backdrop-blur"
          >
            {MAP_LIST.map((m) => (
              <button
                key={m.id}
                data-hud="1"
                onClick={() => chooseMap(m.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                  m.id === roomId
                    ? "border-emerald-400/60 bg-emerald-500/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white/90">
                    {m.name}
                  </span>
                  <span className="block text-[10px] leading-snug text-white/55">
                    {m.blurb}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── 🎮 Mini-games (Phase 16) — ဝင်ကြေး မယူဘူး၊ ဆုက cosmetic သာ
            (spec 16.4)။ Scoreboard/lobby/ရလဒ်က GamesOverlays (အောက်မှာ)။ */}
        <GamesMenu
          games={gameList}
          connected={link === "live"}
          open={menu === "games"}
          onToggle={() => setMenu((m) => (m === "games" ? null : "games"))}
          onJoin={(gameId) => netRef.current?.sendGameJoin(gameId)}
        />

        {/* 🏗 ဆောက်လုပ်ရေး (Phase 18) ကို ☰ Menu → 🌍 လောက ထဲ ရွှေ့လိုက်ပြီ
            — ဖန်သားပြင်ပေါ် ခလုပ်တွေ လျှော့ဖို့။ ဆောက်ခွင့်ရှိ/မရှိ ဆိုတဲ့
            **အမှန်တရားက server မှာပဲ** ရှိတယ် (`/plot/[id]/build`)。 */}

        {/* ── 🎙 Voice chat (Phase 14) — ဖွင့်/ပိတ်က ☰ Menu → 🔊 အသံ မှာ။
            ဒီ panel က **ဝင်ပြီးမှ** ပေါ်တယ် (ဘယ်သူတွေ ရှိလဲ၊ mute၊ report
            လိုတဲ့အခါ) — မဝင်ရသေးဘဲ mic ခလုတ် ချိတ်လွဲနေတာ ရှင်းလိုက်တယ်။ */}
        {voiceState !== "off" && (
        <VoicePanel
          state={voiceState}
          micOn={micOn}
          peers={voicePeers}
          mutes={voiceMutes}
          meId={meId}
          room={roomId}
          names={(id) => nameOfRef.current(id)}
          open={menu === "voice"}
          onToggle={() => setMenu((m) => (m === "voice" ? null : "voice"))}
          onJoin={() => {
            setVoiceState("joining");
            void voiceRef.current?.join();
          }}
          onLeave={() => {
            voiceRef.current?.leave();
            setVoiceState("off");
            setVoicePeers([]);
            setMicOn(false);
          }}
          onMic={(on) => {
            voiceRef.current?.setMic(on);
            setMicOn(voiceRef.current?.micOn ?? false);
          }}
          onMutePeer={(id, muted) => {
            voiceRef.current?.mutePeer(id, muted);
            setVoiceMutes((prev) => {
              const next = new Set(prev);
              if (muted) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
        />
        )}
      </div>
      </div>

      {/* ── ညာဘက်အပေါ်: minimap + ခလုတ်များ ─────────────────────────── */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        {/* Guest ကို sign in ဖိတ်ခေါ်တာ — မဖြစ်မနေမဟုတ်ဘူး၊ ရွေးစရာတစ်ခုပဲ */}
        {link === "live" && !meAuthed && (
          <a
            href="/login"
            data-hud="1"
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur hover:bg-black/60"
          >
            Gwave နဲ့ ဝင်မယ်
          </a>
        )}

        <canvas
          ref={mapRef}
          data-hud="1"
          aria-label="မြေပုံ"
          className="h-[132px] w-[132px] rounded-full"
        />

        {/* ── ☰ Menu — ခလုပ်တွေအားလုံး category အလိုက် (hud-menu.tsx) ──
            ★ အရင်က Avatar · bloom · အရိပ် · အသံ · 1st/3rd ဆိုပြီး ခလုပ်
              ၅ ခု တန်းလျား ထားတယ် — ဖုန်းမှာ မြင်ကွင်းကို ကွယ်တယ်။
              အခု switch တွေနဲ့ menu တစ်ခုထဲ စုလိုက်တယ်။ */}
        <HudMenu
          open={menu === "settings"}
          onToggle={() => setMenu((m) => (m === "settings" ? null : "settings"))}
          sound={sound}
          onSound={(on) => {
            const a = audioRef.current;
            if (!a) return;
            if (on) void a.enable().then(setSound);
            else {
              a.disable();
              setSound(false);
            }
          }}
          voiceState={voiceState}
          micOn={micOn}
          onVoice={(on) => {
            if (on) {
              setVoiceState("joining");
              void voiceRef.current?.join();
            } else {
              voiceRef.current?.leave();
              setVoiceState("off");
              setVoicePeers([]);
              setMicOn(false);
            }
          }}
          onMic={(on) => {
            voiceRef.current?.setMic(on);
            setMicOn(voiceRef.current?.micOn ?? false);
          }}
          fpv={fpv}
          onFpv={(on) => fpvSetRef.current?.(on)}
          bloom={bloom}
          bloomLocked={degraded}
          onBloom={setBloom}
          shadows={shadows}
          onShadows={setShadows}
          onAvatar={() => {
            setMenu(null);
            setDressing(true);
          }}
          onMap={() => setMenu("map")}
          onGames={() => setMenu("games")}
          onBuild={() => {
            setMenu(null);
            setBuilding(true);
          }}
          mapLabel={`${getMap(roomId).emoji} ${getMap(roomId).name}`}
        />

        {/* ── ပိုင်ဆိုင်မှု (Phase W8) ────────────────────────────────
            ★ ဒါက **ဖြည့်စွက်သာ** — မချိတ်ဘဲ လောကက အပြည့်အဝ အလုပ်လုပ်တယ်။
            Sign in ဝင်ထားသူကိုသာ ပြတယ် (Gwave အကောင့်တစ်ခုနဲ့ ချိတ်တာမို့
            ဧည့်သည်မှာ ချိတ်စရာ အကောင့်မရှိဘူး)。
            ★ Chip နှိပ်မှ sheet တက်တယ် — အဝင်မှာ ချက်ချင်း မမေးဘူး
            (W8.7 ရဲ့ ပထမဆုံး အမှား)。 */}
        {meAuthed && <OwnershipControl wallet={wallet} onChange={setWallet} />}

        {/* ★ လျှော့ချလိုက်တာကို **တိတ်တိတ်မလုပ်ရ** — ဘာလို့ ရုပ်ညံ့သွားလဲ
            မသိရင် "ဒီ site က ချွတ်ယွင်းနေတယ်" လို့ ထင်မယ်။ ပြန်မြှင့်ဖို့
            လမ်းလည်း ပေးထားရမယ်။ */}
        {degraded && (
          <div
            data-hud="1"
            className="max-w-[16rem] rounded-lg border border-amber-400/40 bg-black/60 px-2.5 py-1.5 text-right text-[11px] leading-snug text-amber-200 backdrop-blur"
          >
            စက်နှေးလို့ ရုပ်ထွက်ကို လျှော့ချလိုက်ပါတယ်။
            <button
              onClick={() => {
                restoreRef.current?.();
                setDegraded(false);
                setShadows(true);
              }}
              className="ml-1 underline underline-offset-2 hover:text-amber-100"
            >
              ပြန်မြှင့်
            </button>
          </div>
        )}
      </div>

      {/* ── Avatar ပြင်ဆင်ရေး ─────────────────────────────────────────── */}
      {dressing && (
        <AvatarCustomiser
          onClose={() => {
            setDressing(false);
            // scene ကို ပြန်ဆောက်ပြီး avatar အသစ်နဲ့ စတယ်
            setAvatarNonce((n) => n + 1);
          }}
        />
      )}

      {/* ── ယာဉ် — အနားရောက်မှ / စီးနေချိန် ─────────────────────────── */}
      {ride && (
        <button
          data-hud="1"
          onClick={() => rideRef.current?.()}
          className="absolute bottom-32 left-1/2 z-10 -translate-x-1/2 rounded-full border border-amber-400/50 bg-black/60 px-4 py-2 text-xs text-amber-200 backdrop-blur transition hover:bg-black/80 sm:bottom-20"
        >
          {ride.riding ? `${ride.label} — ဆင်းရန် (E)` : `${ride.label} — စီးရန် (E)`}
        </button>
      )}

      {/* ── Landmark — အနားရောက်မှ ပေါ်တယ် ───────────────────────────── */}
      {nearby && (
        <a
          href={nearby.href}
          data-hud="1"
          className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-black/60 px-4 py-2 text-xs text-emerald-200 backdrop-blur transition hover:bg-black/80"
        >
          {nearby.label} — ဝင်ရန် နှိပ်ပါ
        </a>
      )}

      {/* ── Chat ─────────────────────────────────────────────────────── */}
      {link !== "off" && (
        <div className="absolute bottom-20 left-3 z-10 w-[min(19rem,60vw)] sm:bottom-3 sm:w-72">
          <div className="mb-1 max-h-40 space-y-0.5 overflow-hidden">
            {chat.slice(-6).map((c, i) => (
              <div
                key={`${c.at}-${i}`}
                className="w-fit max-w-full rounded bg-black/45 px-2 py-1 text-[11px] leading-snug text-white/90 backdrop-blur"
              >
                <span
                  className={
                    c.authed
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-white/70"
                  }
                >
                  {c.name}
                </span>
                {/* ★ ဧည့်သည်ကို အမြဲ အမှတ်အသားပြ — မပြရင် ဧည့်သည်တစ်ယောက်က
                    တခြားသူ့နာမည်ပေးပြီး အဲဒီလူအဖြစ် ဟန်ဆောင်လို့ရမယ် */}
                {!c.authed && (
                  <span className="ml-1 rounded bg-white/15 px-1 text-[9px] text-white/60">
                    ဧည့်သည်
                  </span>
                )}{" "}
                {/* textContent အဖြစ်သာ ထည့်တယ် — innerHTML သုံးရင် chat ကနေ
                    script ထည့်လို့ရသွားမယ် */}
                {c.text}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              netRef.current?.sendChat(t);
              setDraft("");
            }}
          >
            <input
              data-hud="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              placeholder="စာရိုက်ရန်…"
              className="w-full rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white outline-none backdrop-blur placeholder:text-white/35 focus:border-emerald-400/60"
            />
          </form>
        </div>
      )}

      {/* ── 🎮 Game overlays — scoreboard / lobby / ရလဒ် / လုပ်ဆောင်ချက်
          ခလုတ်။ Screen center / ညာအောက်ကို absolute နဲ့ ကပ်လို့ ဘယ်ဘက်တန်း
          (containing block) ထဲ ထည့်လို့မရဘူး — ဒီမှာပဲ ထားတယ်။ */}
      <GamesOverlays
        phase={phase}
        meId={meId}
        onJoin={(gameId) => netRef.current?.sendGameJoin(gameId)}
        onAction={(a) => gameActionRef.current?.(a)}
        onDismissEnd={() => setPhase({ kind: "idle" })}
      />

      {building && (
        <BuildPanel bridge={buildRef} onClose={() => setBuilding(false)} />
      )}

      {/* Emote bar — game room မှာ ဖျောက်တယ် (အောက်ဗဟိုက ❤️/ကျည် ပြသချက်
          နေရာ + ပွဲထဲမှာ မလိုအပ်တဲ့ ခလုတ် လျှော့) */}
      {roomId !== "arena" && roomId !== "hide-1" && (
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {EMOTES.map((e) => (
          <button
            key={e.key}
            data-hud="1"
            onClick={() => setEmote(emote === e.key ? null : e.key)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg backdrop-blur transition ${
              emote === e.key
                ? "border-emerald-400 bg-emerald-500/30"
                : "border-white/20 bg-black/40 hover:bg-black/60"
            }`}
            aria-label={e.label}
            title={e.label}
          >
            {e.icon}
          </button>
        ))}
      </div>
      )}

      {/* Mobile joystick — sm အထက်မှာ ဖျောက် */}
      <div
        data-stick
        data-hud="1"
        className={`absolute bottom-6 left-6 z-10 h-28 w-28 touch-none rounded-full border border-white/20 bg-black/30 backdrop-blur ${touch ? "" : "hidden"}`}
      >
        <div
          data-knob
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30"
        />
      </div>
      <button
        data-jump
        data-hud="1"
        className={`absolute bottom-8 right-6 z-10 h-20 w-20 touch-none rounded-full border border-white/20 bg-black/30 text-sm text-white/80 backdrop-blur ${touch ? "" : "hidden"}`}
      >
        ခုန်
      </button>
    </div>
  );
}
