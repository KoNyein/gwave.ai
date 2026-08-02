"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createSpatialAudio, type SpatialAudio } from "./audio";
import { AvatarCustomiser } from "./avatar/customiser";
import { DEFAULT_AVATAR, sanitizeAvatar, type AvatarConfig } from "./avatar/config";
import { applyAvatarConfig } from "./avatar/parts";
import { BuildPanel, type BuildBridge } from "./build/panel";
import { createPlotStream } from "./build/plots";
import { createBuildRender, createGhost } from "./build/render";
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
  const [menu, setMenu] = useState<"map" | "games" | "voice" | null>(null);
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
    const saved = window.localStorage.getItem(MAP_KEY);
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

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const map = getMap(roomId);

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
        onStatus: (connected, detail) => {
          if (connected) setLink("live");
          else if (detail === "auth") setLink("auth");
          else setLink("connecting");
        },
      });
      netRef.current = net;
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
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = keyMap[e.code];
      if (k) (input[k] as number) = 0;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.run = false;
      if (e.code === "ControlLeft" || e.code === "ControlRight") input.crouch = false;
      if (e.code === "Space") input.jump = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── ကင်မရာ drag ───────────────────────────────────────────────────────
    let dragId: number | null = null;
    let dragX = 0;
    let dragY = 0;
    const onPointerDown = (e: PointerEvent) => {
      // Joystick ဧရိယာက touch ကို ကင်မရာ မယူရ
      if ((e.target as HTMLElement).dataset?.hud) return;
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
      // Pointer lock ထဲမှာ — movementX/Y နဲ့ တိုက်ရိုက်လှည့်တယ်
      if (document.pointerLockElement === el) {
        cam.yaw -= e.movementX * 0.0028;
        cam.pitch = THREE.MathUtils.clamp(
          cam.pitch + e.movementY * 0.0022,
          fpvRef.current ? -1.2 : -0.25,
          1.2,
        );
        return;
      }
      if (dragId !== e.pointerId) return;
      cam.yaw -= (e.clientX - dragX) * 0.005;
      // ★ FP မှာ မော့ကြည့်လို့ရအောင် pitch ကို အောက်ဘက် ပိုကျယ်ပေးတယ် —
      // third-person မှာတော့ မြေအောက် မြင်သွားမှာမို့ -0.25 ပဲ။
      cam.pitch = THREE.MathUtils.clamp(
        cam.pitch + (e.clientY - dragY) * 0.004,
        fpvRef.current ? -1.2 : -0.25,
        1.2,
      );
      dragX = e.clientX;
      dragY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragId === e.pointerId) dragId = null;
    };
    const onWheel = (e: WheelEvent) => {
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
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // ── Mobile joystick ───────────────────────────────────────────────────
    // DOM element ၂ ခုနဲ့ — React state မသုံးဘူး၊ touch တိုင်း re-render
    // ဖြစ်သွားမှာမို့။
    const stick = mount.querySelector<HTMLElement>("[data-stick]");
    const knob = mount.querySelector<HTMLElement>("[data-knob]");
    let stickId: number | null = null;
    const stickRadius = 46;

    const stickStart = (e: PointerEvent) => {
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
  }, [roomId, avatarNonce]);

  return (
    <div ref={mountRef} className="relative h-full w-full">
      {/* နာမည်တံဆိပ်တွေ ကပ်တဲ့နေရာ — 3D မဟုတ်ဘဲ DOM (nametags.ts) */}
      <div
        ref={tagsRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      />

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

        {/* ── 🏗 ဆောက်လုပ်ရေး (Phase 18) — ကိုယ်ပိုင်ကွက်ပေါ်မှာသာ
            ဆောက်လို့ရတယ်၊ **အမှန်တရားက server မှာ** (`/plot/[id]/build`)။ */}
        {!building && (
          <button
            data-hud="1"
            onClick={() => setBuilding(true)}
            title="ဆောက်လုပ်ရန်"
            className="rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur hover:bg-black/70"
          >
            🏗 ဆောက်မယ်
          </button>
        )}

        {/* ── 🎙 Voice chat (Phase 14) ── */}
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

        <div className="flex gap-2">
          <button
            data-hud="1"
            onClick={() => setDressing(true)}
            title="Avatar ပြင်ဆင်ရန်"
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/70 backdrop-blur transition hover:bg-black/60"
          >
            🧑 Avatar
          </button>

          {/* ★ Bloom ကို ပိတ်လို့ရရမယ် — ဖုန်းအဟောင်းမှာ frame ကို ထက်ဝက်
              နီးပါး စားတယ်။ ရွေးချယ်မှုက localStorage မှာ ကျန်တယ်။ */}
          <button
            data-hud="1"
            onClick={() => setBloom((b) => !b)}
            title="အလင်းအရောင် (bloom)"
            className={`rounded-lg border px-2 py-1 text-[11px] backdrop-blur transition ${
              bloom && !degraded
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 bg-black/40 text-white/60"
            }`}
          >
            ✨ {bloom && !degraded ? "ဖွင့်" : "ပိတ်"}
          </button>

          {/* အရိပ်က shadow map တစ်ခုလုံး ပြန်ဆွဲရတာမို့ ဖုန်းအဟောင်းမှာ
              အကြီးမားဆုံး ကုန်ကျစရိတ်တစ်ခု */}
          <button
            data-hud="1"
            onClick={() => setShadows((s) => !s)}
            title="အရိပ် (shadows)"
            className={`rounded-lg border px-2 py-1 text-[11px] backdrop-blur transition ${
              shadows
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 bg-black/40 text-white/60"
            }`}
          >
            🌒 {shadows ? "ဖွင့်" : "ပိတ်"}
          </button>

          {/* ★ Browser က user gesture ပြီးမှ audio ခွင့်ပြုတယ် — ဒါကြောင့်
              default ပိတ်ထားပြီး ဒီခလုတ်ကနေသာ ဖွင့်လို့ရတယ်။ */}
          <button
            data-hud="1"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.enabled) {
                a.disable();
                setSound(false);
              } else {
                void a.enable().then(setSound);
              }
            }}
            title="ခြေသံ (spatial audio)"
            className={`rounded-lg border px-2 py-1 text-[11px] backdrop-blur transition ${
              sound
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 bg-black/40 text-white/60"
            }`}
          >
            {sound ? "🔊 အသံ" : "🔇 အသံ"}
          </button>

          {/* ★ First-person / third-person ပြောင်းခလုတ် (V) — ဖုန်းမှာ
              scroll မရှိလို့ ဒီခလုတ်က တစ်ခုတည်းသော လမ်း။ */}
          <button
            data-hud="1"
            onClick={() => fpvSetRef.current?.(!fpv)}
            title="မြင်ကွင်းပြောင်း (V) — ဇာတ်ကောင်မျက်စိထဲက / နောက်ကနေ"
            className={`rounded-lg border px-2 py-1 text-[11px] backdrop-blur transition ${
              fpv
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 bg-black/40 text-white/60"
            }`}
          >
            👁 {fpv ? "1st" : "3rd"}
          </button>
        </div>

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

      {/* Emote bar */}
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
