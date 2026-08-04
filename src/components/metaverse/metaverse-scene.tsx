"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import { createVoiceLines } from "./voicelines";
import { createCombatFx, type CombatFx } from "./combatfx";
import { createGameFx, type GameFx } from "./gamefx";
import { GamesMenu, GamesOverlays, type GamePhase } from "./games-panel";
import { createHuman, type Avatar, type HumanState } from "./human";
import { buildLandmarks, type Landmark } from "./landmarks";
import {
  attachLiveScreen,
  attachLiveKitScreen,
  type LiveScreen,
} from "./livescreen";
import { createMvGoLive, type MvCamMode } from "./golive";
import { createScanFaces } from "./scanface";
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
import { buildWeaponMesh, disposeWeapon } from "./weapons3d";
import { createDog } from "./dog3d";
import {
  createRiggedHuman,
  soldierVariantFor,
  SOLDIER_VARIANTS,
} from "./riggedhuman";
import { OwnershipControl } from "./web3/ownership";
import { buildWorld, insideCollider, resolveCollision } from "./world";
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
  /// 🔋 ဘက်ထရီချွေတာ mode — 30fps ကန့် + pixelRatio 1 + အရိပ်ပိတ်။
  /// ဖုန်းပူ/ဘက်ထရီစား ပြဿနာအတွက် user ကိုယ်တိုင် ဖွင့်ပိတ်လို့ရတယ်၊
  /// ရွေးချယ်မှုက localStorage မှာ ကျန်တယ်။
  const [eco, setEco] = useState(false);
  const ecoRef = useRef(false);
  const ecoApplyRef = useRef<((on: boolean) => void) | null>(null);
  useEffect(() => {
    const on = window.localStorage.getItem("mv:eco") === "1";
    ecoRef.current = on;
    setEco(on);
  }, []);
  const toggleEco = () => {
    const on = !ecoRef.current;
    ecoRef.current = on;
    setEco(on);
    try {
      window.localStorage.setItem("mv:eco", on ? "1" : "0");
    } catch {
      /* private mode */
    }
    ecoApplyRef.current?.(on);
  };
  /// 🖼 Avatar ခေါင်းပေါ် profile ဓာတ်ပုံ ပြ/ဖျောက် — default ပြတယ်၊
  /// privacy အတွက် ဖျောက်လို့ရတယ် (ရွေးချယ်မှု localStorage မှာ ကျန်တယ်)။
  /// ဖျောက်ထားရင် server က တခြားသူတွေဆီ URL လုံးဝ မပို့ဘူး။
  const [showPic, setShowPic] = useState(true);
  const showPicRef = useRef(true);
  const picSendRef = useRef<((on: boolean) => void) | null>(null);
  useEffect(() => {
    const on = window.localStorage.getItem("mv:showpic") !== "0";
    showPicRef.current = on;
    setShowPic(on);
  }, []);
  const togglePic = () => {
    const on = !showPicRef.current;
    showPicRef.current = on;
    setShowPic(on);
    try {
      window.localStorage.setItem("mv:showpic", on ? "1" : "0");
    } catch {
      /* private mode */
    }
    picSendRef.current?.(on);
  };
  /// 🔴 Metaverse Go Live — game မြင်ကွင်းကို feed ဆီ တိုက်ရိုက်လွှင့်ခြင်း။
  /// "starting" ကြားအခြေအနေက ခလုတ်နှစ်ခါနှိပ် race မဖြစ်အောင်။
  const [mvLive, setMvLive] = useState<"off" | "starting" | "on">("off");
  const goLiveRef = useRef<((title: string) => Promise<boolean>) | null>(null);
  /// ★ Error ကို **မျက်မြင် toast** နဲ့ ပြရမယ် — အရင်က တိတ်တိတ် မျိုလို့
  /// user က "ခလုတ် နှိပ်လို့မရဘူး" လို့ပဲ ထင်နေတယ်။
  const [mvErr, setMvErr] = useState<string | null>(null);
  const mvErrTimer = useRef<number>(0);
  const showMvErr = (msg: string) => {
    setMvErr(msg);
    window.clearTimeout(mvErrTimer.current);
    mvErrTimer.current = window.setTimeout(() => setMvErr(null), 6000);
  };
  const toggleGoLive = () => {
    if (mvLive === "starting" || !goLiveRef.current) return;
    if (mvLive === "off") {
      const title = `${meName || "Gwave"} — ${getMap(roomId).emoji} ${getMap(roomId).name} Metaverse Live`;
      setMvLive("starting");
      goLiveRef.current(title).then(
        (ok) => setMvLive(ok ? "on" : "off"),
        (err: unknown) => {
          setMvLive("off");
          showMvErr(err instanceof Error ? err.message : "Live စတင်လို့ မရဘူး");
        },
      );
    } else {
      void goLiveRef.current("").then(() => setMvLive("off"));
    }
  };
  /// 🤳 Host ကင်မရာ PiP — off → မျက်နှာ (front) → အနောက် (back) → off
  const [mvCam, setMvCam] = useState<MvCamMode>("off");
  const camRef = useRef<((m: MvCamMode) => Promise<void>) | null>(null);
  const cycleCam = () => {
    const next: MvCamMode =
      mvCam === "off" ? "user" : mvCam === "user" ? "environment" : "off";
    setMvCam(next);
    camRef.current?.(next).catch((err: unknown) => {
      setMvCam("off");
      showMvErr(
        err instanceof Error ? err.message : "ကင်မရာ ဖွင့်လို့ မရဘူး",
      );
    });
  };
  /// ☰ Game room ရဲ့ ဒုတိယအဆင့် ခလုတ်များ ခေါက်သိမ်း/ဖြန့် — default
  /// ခေါက်ထား (မြင်ကွင်း အကွယ် နည်းအောင်)
  const [hudMore, setHudMore] = useState(false);
  /// 🤝 NPC context ခလုတ် — မိတ်ဆွေဖွဲ့လို့ရတဲ့ NPC တစ်ယောက် အနီး
  /// (FRIEND_RANGE) ရောက်မှ ပေါ်တယ် (PUBG/GTA style context action)။
  /// null = ဘယ်သူမှ မနီးဘူး၊ string = အနီးဆုံး NPC နာမည်
  const [npcNear, setNpcNear] = useState<string | null>(null);
  /// လက်ပြပြီး မိတ်ဆွေဖွဲ့ — 🤝 chip ရော context ခလုတ်ရော ဒီတစ်ခုတည်း သုံး
  const waveBefriend = () => {
    setEmote("wave");
    window.setTimeout(() => setEmote(null), 1600);
  };
  // ဒီ ၃ ခုက မကြာခဏမပြောင်းလို့ React state နဲ့ ရတယ် (position မဟုတ်ဘူး)
  const [online, setOnline] = useState(1);
  // ssr:false မို့ ဒီ initializer က browser မှာပဲ ပြေးတယ် — window သုံးလို့ရတယ်
  const [link, setLink] = useState<"off" | "connecting" | "live" | "auth">(() =>
    wsCandidates().length > 0 ? "connecting" : "off",
  );
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  /// 💬 Touch chat input ဖွင့်/ပိတ် — input က screen ထိပ်မှာ ပွင့်တယ်
  /// (keyboard က အောက်က တက်လာလို့ ထိပ်ကဟာ မကွယ်ဘူး)
  const [chatOpen, setChatOpen] = useState(false);
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
  type ArenaBoardRow = {
    id: string;
    name: string;
    score: number;
    alive: boolean;
    /// 🏴‍☠️ ဓားပြ NPC — scoreboard မှာ ခွဲပြဖို့
    bot?: boolean;
    /// 🐕 ခွေး NPC — ခွေး 3D model + 🐕 tag
    dog?: boolean;
  };
  type ArenaYou = {
    hp: number;
    alive: boolean;
    kills: number;
    score: number;
    /// လူမှားသတ်မိမှု အရေအတွက် — scoreboard မှာ ✗ နဲ့ ပြတယ်
    wrongKills?: number;
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
    /// ပထမဆုံး ဘယ်နှစ်ယောက်သတ်ရင် နိုင်လဲ — aInit က server တန်ဖိုး
    killsToWin: number;
  }>({ weapons: {}, you: null, board: [], feed: [], denied: false, killsToWin: 3 });
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
  /// ❓ ခလုတ်လမ်းညွှန် — game room မှာ default ဖျောက်ထားပြီး ❓ နှိပ်မှ ပြတယ်
  /// (စာတန်းရှည်က weapons strip နဲ့ ထပ်လို့)
  const [showHelp, setShowHelp] = useState(false);
  /// 📜 ပြိုင်ပွဲစည်းမျဉ်း / user guide panel
  const [showRules, setShowRules] = useState(false);
  /// 👤 ရုပ်ပြင်ခန်း ပိတ်ချိန် — game room မှာ scene ပြန်မဆောက်ဘဲ
  /// config အသစ်ကို လက်ရှိ avatar ပေါ် တိုက်ရိုက် တင်ဖို့
  const applyAvatarRef = useRef<(() => void) | null>(null);

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

  /// ★ HUD ဇုန် design standard — element တိုင်း ကိုယ့်ဇုန်ထဲမှာပဲ နေရမယ်၊
  /// ဇုန်ချင်း ဘယ်တော့မှ မထပ်ရ (screenshot တွေမှာ တွေ့ခဲ့တဲ့ ထပ်နေမှုတွေရဲ့
  /// အဖြေ)။ ဇုန်များ:
  ///   ↖ ဘယ်အပေါ်  — room chips + compact panel (game action row ပါ)
  ///   ↑ အလယ်အပေါ် — weapons strip (arena) / ပွဲအခြေအနေ (hide)
  ///   ↗ ညာအပေါ်   — minimap + ☰ Menu (social extras က game room မှာ ဖျောက်)
  ///   ↙ ဘယ်အောက် — joystick + chat (game room မှာ chat ကျဉ်း)
  ///   ↓ အလယ်အောက် — ❤️/ကျည် ဖတ်ရုံ pill
  ///   ↘ ညာအောက်  — ခုန် + 🔫/🔄/🎯/🧎 combat cluster
  const inGameRoom = roomId === "arena" || roomId === "hide-1";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const map = getMap(roomId);
    setArenaHud({ weapons: {}, you: null, board: [], feed: [], denied: false, killsToWin: 3 });
    setHideHud({ phase: "waiting", endsAt: null, role: null, blindUntil: null, players: [], feed: [] });
    setShowBoard(false);
    setHitMark(null);
    setNpcNear(null);
    setDmgOn(false);
    setBanner(null);
    setInvited(false);
    setAdsBoth(false);
    setCrouchOn(false);
    setDmgNums([]);
    setHurtFrom(null);
    setShowHelp(false);
    setShowRules(false);
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

    // 🔋 Eco mode — render ကုန်ကျမှု ချက်ချင်း လျှော့/ပြန်တင်။ FPS ကန့်က
    // tick ထဲမှာ (ecoRef ကို frame တိုင်း ကြည့်တယ်)။
    ecoApplyRef.current = (on: boolean) => {
      if (on) {
        renderer.setPixelRatio(1);
        applyShadows(false);
      } else if (!degradedRef.current) {
        renderer.setPixelRatio(inApp ? 1 : Math.min(window.devicePixelRatio, 2));
        applyShadows(window.localStorage.getItem(SHADOW_KEY) !== "0");
      }
    };
    if (ecoRef.current) ecoApplyRef.current(true);

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
    /// 🗣 မြန်မာအသံ ကြေညာချက် + NPC တုံ့ပြန်သံ (device TTS)
    const voice = map.id === "arena" ? createVoiceLines() : null;
    /// aYou ကနေ update ဖြစ်တဲ့ ကိုယ့် combat အခြေအနေ — fire feedback အတွက်
    const combat = { weapon: "pistol", alive: true, ammo: -1, prevWeapon: "knife" };
    /// လက်နက် fireMs — aInit က server တန်ဖိုးတွေနဲ့ ပြည့်တယ် (auto-fire နှုန်း)။
    /// Server ကလည်း ကိုယ့်ဘက်က ထပ်စစ်တယ် — ဒါက client ရဲ့ ကြိုကန့်သတ်ချက်ပဲ။
    const wFireMs: Record<string, number> = {};
    /// လက်နက် မြန်မာအမည် — aPickup toast မှာ ပြဖို့ (aInit က ပြည့်တယ်)
    const wNames: Record<string, string> = {};
    /// 🔫 မြေပေါ်ကျနေတဲ့ လက်နက် drop များ — server ရဲ့ aDrop/aDropGone နဲ့
    /// အတူ လိုက်တယ်။ လှည့်နေတဲ့ 3D mesh က "ကောက်လို့ရတယ်" ဆိုတာ မြင်သာစေတယ်။
    const dropMeshes = new Map<number, THREE.Group>();
    let dropSpinT = 0;
    const removeDrop = (id: number) => {
      const g = dropMeshes.get(id);
      if (!g) return;
      dropMeshes.delete(id);
      scene.remove(g);
      disposeWeapon(g);
    };
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
    /// 💥 ဗုံးဒဏ်ကြောင့် လွင့်စင်မှု (knockback) — impulse ပြီး ဖြည်းဖြည်း သေတယ်
    const kb = { x: 0, z: 0 };
    let lastFireLocal = 0;
    let firing = false;
    /// 🚶 FP head-bob အတွက် လမ်းလျှောက်ချိန်တိုင်း — movement ကို ခံစားရအောင်
    let walkT = 0;
    /// 📳 ဖုန်းတုန်ခါမှု — ပစ်/ထိ/သေ တိုင်း ရင်ခုန်စေဖို့။ Support မရှိရင်
    /// (iOS Safari) တိတ်တိတ် ကျော်တယ်။
    const buzz = (pattern: number | number[]) => {
      try {
        navigator.vibrate?.(pattern);
      } catch {
        /* unsupported */
      }
    };
    /// 🔫 လက်ထဲကိုင်ထားတဲ့ လက်နက် 3D — avatar (TP) + FP viewmodel။
    /// Avatar တစ်ကိုယ်ချင်း userData ထဲ kind/mesh သိမ်းပြီး ပြောင်းမှ swap။
    const setHandWeapon = (
      av: { group: THREE.Group; attach: { handR: THREE.Object3D } },
      kind: string,
    ) => {
      if (av.group.userData.weaponKind === kind) return;
      av.group.userData.weaponKind = kind;
      const old = av.group.userData.weaponMesh as THREE.Group | undefined;
      if (old) {
        old.parent?.remove(old);
        disposeWeapon(old);
      }
      const mesh = buildWeaponMesh(kind);
      mesh.rotation.x = -0.35;
      av.attach.handR.add(mesh);
      av.group.userData.weaponMesh = mesh;
    };
    /// FP viewmodel — ကင်မရာအောက်ညာမှာ ကိုင်ထားတဲ့ လက်နက် (PUBG-style)။
    /// Camera child ကို render ဖို့ scene ထဲ camera ထည့်ရတယ်။
    let vmKind = "";
    let vmKick = 0;
    /// 🔪 ဓားဝှေ့ animation ကျန်ချိန် — ဓားက ကျည်လမ်းကြောင်းမဟုတ်ဘဲ ဝှေ့တယ်
    let swingT = 0;
    const vmGroup = new THREE.Group();
    if (map.id === "arena") {
      scene.add(camera);
      vmGroup.position.set(0.34, -0.3, -0.62);
      vmGroup.rotation.y = Math.PI;
      vmGroup.visible = false;
      camera.add(vmGroup);
    }

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
    // 🔴 Metaverse Go Live — renderer ရဲ့ canvas ကို 30fps ဖမ်းပြီး
    // LiveKit ကနေ feed ဆီ လွှင့်တယ် (golive.ts)။ active ဖြစ်နေရင်
    // ထပ်ခေါ်တာက stop — toggle သဘော။
    const mvGoLive = createMvGoLive(renderer.domElement);
    goLiveRef.current = async (title: string) => {
      if (mvGoLive.active) {
        await mvGoLive.stop();
        return false;
      }
      // ★ Error ကို ဒီမှာ မမျိုဘူး — UI (toggleGoLive) က ဖမ်းပြီး toast ပြမယ်
      await mvGoLive.start(title);
      return true;
    };
    // 🤳 ကင်မရာ PiP mode — UI chip ကနေ ချိတ်တယ်
    camRef.current = (m: MvCamMode) => mvGoLive.setCamera(m);

    restoreRef.current = () => {
      renderer.setPixelRatio(inApp ? 1 : Math.min(window.devicePixelRatio, 2));
      postfx.setSize(mount.clientWidth, mount.clientHeight);
      quality.reset();
    };

    // ── ကိုယ့်လူရုပ် ───────────────────────────────────────────────────────
    // 🎖 Arena မှာ ကိုယ်တိုင်လည်း rigged soldier — variant ကို တစ်ခါမဲပြီး
    // localStorage မှာ မှတ်ထားလို့ ဝင်တိုင်း ရုပ်တူနေတယ်။ Social room
    // တွေမှာတော့ ရုပ်ပြင်ခန်း customize လုပ်လို့ရတဲ့ procedural body။
    const myVariant = (() => {
      try {
        let v = window.localStorage.getItem("mv:soldier");
        if (!v || !SOLDIER_VARIANTS.includes(v)) {
          v = SOLDIER_VARIANTS[Math.floor(Math.random() * SOLDIER_VARIANTS.length)] ?? "a";
          window.localStorage.setItem("mv:soldier", v);
        }
        return v;
      } catch {
        return "a";
      }
    })();
    const me: Avatar =
      map.id === "arena" ? createRiggedHuman(myVariant) : createHuman(0x44bba4, 0xe8b088);
    scene.add(me.group);
    // 🖼 ကိုယ့် profile ဓာတ်ပုံ URL — avatar API ကနေ လာတယ်။ ပြထားရင်
    // server ဆီ ပို့ပြီး တခြားသူတွေရဲ့ nametag မှာ ပေါ်တယ်။
    let myPic: string | null = null;
    const syncPic = () => {
      net?.sendPic(showPicRef.current && myPic ? myPic : null);
    };
    picSendRef.current = (on) => {
      net?.sendPic(on && myPic ? myPic : null);
    };
    // ★ သိမ်းထားတဲ့ avatar ကို ဖတ်ပြီး တင်တယ် — မရရင် default နဲ့ ဆက်သွားတယ်။
    // Arena မှာ ကိုယ့် body က rigged GLB မို့ procedural config မတင်ဘူး —
    // profile pic (myPic) ကတော့ room မရွေး လိုတယ်။
    void fetch("/api/metaverse/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            config?: AvatarConfig;
            pic?: string | null;
            scanFace?: string | null;
          } | null,
        ) => {
          if (killed || !d) return;
          if (d.config && map.id !== "arena") {
            applyAvatarConfig(me, sanitizeAvatar(d.config, new Set()));
          }
          // 🧬 ကိုယ့် scan မျက်နှာ — social room မှာသာ (arena က soldier ရုပ်)
          if (typeof d.scanFace === "string" && map.id !== "arena") {
            scanFaces.attachUrl(me, d.scanFace);
          }
          myPic = typeof d.pic === "string" ? d.pic : null;
          syncPic();
        },
      )
      .catch(() => {
        if (map.id !== "arena") applyAvatarConfig(me, DEFAULT_AVATAR);
      });
    // ရုပ်ပြင်ပြီးတိုင်း ပြန်ခေါ်လို့ရတဲ့ live re-apply — scene rebuild မလို
    applyAvatarRef.current = () => {
      if (map.id === "arena") return; // rigged body — config မသက်ဆိုင်ဘူး
      void fetch("/api/metaverse/avatar", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { config?: AvatarConfig } | null) => {
          if (killed || !d?.config) return;
          applyAvatarConfig(me, sanitizeAvatar(d.config, new Set()));
        })
        .catch(() => {
          /* ရုပ်ပြင်မအောင်မြင်လည်း ပွဲက ဆက်သွားရမယ် */
        });
    };

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
    /// 🧬 Scan-face plates — social room avatar ခေါင်းတွေမှာ တကယ့်မျက်နှာ
    const scanFaces = createScanFaces();
    /// 🤝 ကိုယ် မိတ်ဆွေဖွဲ့ပြီးသား NPC id များ — 「မိတ်ဆွေဖွဲ့မယ်」 context
    /// ခလုတ်က friend ဖြစ်ပြီးသားကို ထပ်မပြအောင် (bot သေရင်/ပွဲပြန်စရင်
    /// server ဘက်မှာ friendship ပျက်လို့ ဒီမှာလည်း ဖျက်တယ်)
    const botFriends = new Set<string>();

    /// ★ App ထဲမှာ တစ်ပြိုင်နက် ပြမယ့် လူအရေအတွက်ကို ကန့်သတ်တယ် —
    /// avatar တစ်ယောက်က mesh အများကြီးနဲ့ nametag တစ်ခုစီ ရှိတယ်၊
    /// ဖုန်းမှာ ၅၀ ယောက် ပြရင် frame က ကျတယ် (spec 17.4)。
    const MAX_REMOTES = inApp ? 20 : 80;

    const addRemote = (
      id: string,
      s: RemoteState,
      kind: "human" | "dog" | "soldier" = "human",
    ) => {
      if (remotes.has(id)) return;
      if (remotes.size >= MAX_REMOTES) return;
      // 🐕 ခွေး NPC ဆို ခွေး 3D model၊ 🎖 ဓားပြ NPC ဆို animation clip
      // ပါတဲ့ rigged kit character — Avatar interface တူလို့ ကျန်တာ
      // (lerp/nametag/dispose) အကုန် တစ်လမ်းတည်း။
      // (Player avatar တွေက ရုပ်ပြင်ခန်း customize လုပ်လို့ရတဲ့
      //  procedural human အတိုင်း — GLB နဲ့ အစားထိုးရင် customization ပျက်မယ်)
      // 🎖 Arena မှာ **လူသား remote တွေလည်း** rigged soldier — variant က
      // id hash နဲ့ တည်ငြိမ် (client တိုင်း တူတူမြင်)၊ ဓားပြ bot တွေက
      // သတ်မှတ်ထား variant (b/c/j)။
      const rigged = kind === "soldier" || (kind === "human" && map.id === "arena");
      const avatar =
        kind === "dog"
          ? createDog(s.name?.includes("နက်") ? 0x24201c : 0xb9873c)
          : rigged
            ? createRiggedHuman(
                kind === "soldier"
                  ? (["b", "c", "j"][(Number.parseInt(id.slice(4), 10) || 1) - 1] ?? "b")
                  : soldierVariantFor(id),
              )
            : createHuman(colorFor(id));
      avatar.group.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
      scene.add(avatar.group);
      // 🧬 Social room က လူသား remote — သူ့ scan မျက်နှာ ရှိရင် တပ်ပေး
      // (arena မှာ soldier ရုပ်နဲ့ ကစားတာမို့ မတပ်ဘူး — game identity)
      if (kind === "human" && !rigged) scanFaces.attachFor(id, avatar);
      remotes.set(id, {
        avatar,
        cur: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        target: { x: s.x ?? 0, y: s.y ?? 0, z: s.z ?? 0, ry: s.ry ?? 0 },
        name: s.name ?? "Gwave",
        emote: (s.emote as HumanState["emote"]) ?? null,
        speed: 0,
      });
      nametags?.add(id, s.name ?? "Gwave", s.authed !== false, s.pic ?? null);
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
          // 🖼 ပြထားရင် ကိုယ့် profile ဓာတ်ပုံကို server ဆီ ကြေညာတယ် —
          // avatar fetch က socket ထက် အရင်ပြီးနေရင် ဒီကနေ ပို့တယ်
          syncPic();
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
        // 🖼 တစ်ယောက်ယောက် profile ဓာတ်ပုံ ပြ/ဖျောက် ပြောင်းလိုက်တယ်
        onPic: (id, pic) => {
          nametags?.setPic(id, pic);
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
            case "aInit": {
              // 🐕 NPC သီးသန့်လက်နက် (ကိုက်) ကို လူ့လက်နက်တန်း/ရွေးစာရင်းက
              // ဖျောက်ထားတယ် — server ကလည်း aWeapon မှာ ငြင်းတယ်။
              const wAll =
                (m.weapons as Record<
                  string,
                  { my?: string; fireMs?: number; npc?: boolean }
                >) ?? {};
              const wHuman = Object.fromEntries(
                Object.entries(wAll).filter(([, v]) => !v?.npc),
              );
              setArenaHud((h) => ({
                ...h,
                weapons: wHuman as Record<string, { my: string }>,
                board: (m.players as ArenaBoardRow[]) ?? [],
                killsToWin: Number(m.killsToWin) || 3,
              }));
              arenaWeaponListRef.current = Object.keys(wHuman);
              for (const [wk, wv] of Object.entries(wAll)) {
                wFireMs[wk] = Number(wv?.fireMs) || 350;
                wNames[wk] = String(wv?.my ?? wk);
              }
              // 🏴‍☠️ ဓားပြ bot တွေက presence ထဲ မရှိဘူး (socket မရှိလို့) —
              // assassin state ကနေပဲ remote avatar အဖြစ် ဆောက်တယ်။
              for (const q of (m.players as ArenaBoardRow[]) ?? []) {
                if (!q.bot) continue;
                const qb = q as ArenaBoardRow & {
                  x?: number; y?: number; z?: number; ry?: number; weapon?: string;
                };
                addRemote(
                  q.id,
                  {
                    x: Number(qb.x) || 0,
                    y: Number(qb.y) || 0,
                    z: Number(qb.z) || 0,
                    ry: Number(qb.ry) || 0,
                    name: q.name,
                    authed: false,
                  },
                  q.dog ? "dog" : "soldier",
                );
                const br = remotes.get(q.id);
                if (br && !q.dog) {
                  setHandWeapon(br.avatar, String(qb.weapon ?? "pistol"));
                }
              }
              teleportMe(m.players);
              break;
            }
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
                // 💥 အပျက်အစီး မှန်ကွဲသံ — ပေါက်ကွဲမှုနောက် ခဏအကြာ
                sfx?.glass(0.12);
                const d = Math.hypot(bx - p.x, bz - p.z);
                if (d < 25) {
                  shake = Math.max(shake, 0.4 * (1 - d / 25));
                  buzz(Math.round(30 + 50 * (1 - d / 25)));
                }
                // 💥 အနီးမှာ ပေါက်ရင် avatar လွင့်တယ် — ဗုံးကနေ အဝေးဘက်
                // တွန်း + အပေါ်ခုန် + ပြင်းတဲ့ တုန်ခါမှု (user request)။
                if (d < br * 2) {
                  const k = 1 - d / (br * 2);
                  const ddx = p.x - bx;
                  const ddz = p.z - bz;
                  const dl = Math.hypot(ddx, ddz) || 1;
                  kb.x = (ddx / dl) * 14 * k;
                  kb.z = (ddz / dl) * 14 * k;
                  p.vy = Math.max(p.vy, 5 * k);
                  p.airborne = true;
                  shake = Math.max(shake, 0.55 * k);
                  buzz([90, 40, 130]);
                }
              }
              break;
            }
            case "aShot": {
              // တခြားသူ ပစ်တာ — သူ့နေရာကနေ ကျည်လမ်းကြောင်း + အသံ။
              // ကိုယ့်ပစ်ချက်ကတော့ arenaFireRef မှာ ချက်ချင်း ပြပြီးသား။
              if (m.id === myId) break;
              const rw = String(m.weapon || "pistol");
              // 🔪🐕 Melee (ဓား/ကိုက်) မှာ ကျည်လမ်းကြောင်း/ပြောင်းဝမီး မရှိရ
              const melee = rw === "knife" || rw === "bite";
              const sx = Number(m.x);
              const sy = Number(m.y);
              const sz = Number(m.z);
              const sry = Number(m.ry);
              if (!melee && [sx, sy, sz, sry].every(Number.isFinite)) {
                const from = new THREE.Vector3(sx, sy + 1.35, sz);
                const dir = new THREE.Vector3(Math.sin(sry), 0, Math.cos(sry));
                combatFx?.tracer(from, dir, 30);
                combatFx?.muzzle(from);
              }
              // ပစ်သူ (remote) ရဲ့ လက်ထဲ လက်နက်ကိုလည်း ပြ — aShot က
              // သူ့လက်နက်အမျိုးအစား ပါလာလို့ ဒီကနေ sync လုပ်တယ်။
              // (ကိုက် = ခွေး — လက်နက် mesh မရှိဘူး)
              const shooter = remotes.get(String(m.id));
              if (shooter && rw !== "bite") {
                setHandWeapon(shooter.avatar, rw);
              }
              // 🎖 Rigged avatar ဆို ပစ်တိုင်း ပစ်ဟန် one-shot clip —
              // ဓား/ကိုက်ဆို ဝှေ့ဟန်။ (dog/procedural မှာ playClip မရှိ)
              if (shooter) {
                const playClip = shooter.avatar.group.userData.playClip as
                  | ((name: string, holdMs?: number) => void)
                  | undefined;
                playClip?.(melee ? "attack-melee-right" : "holding-right-shoot");
              }
              sfx?.shot(rw === "bite" ? "knife" : rw);
              break;
            }
            case "aThrown": {
              // 💣 ဗုံးပစ်လွှတ်မှု — fuse ချိန်အတွင်း arc နဲ့ ပျံသွားတာ ပြတယ်။
              // ပေါက်ကွဲမှုက server ရဲ့ aBoom (fuse ပြီးမှ) နဲ့ လာတယ်။
              const fx2 = Number(m.fromX);
              const fz2 = Number(m.fromZ);
              const tx2 = Number(m.x);
              const tz2 = Number(m.z);
              if ([fx2, fz2, tx2, tz2].every(Number.isFinite)) {
                combatFx?.lob(fx2, fz2, tx2, tz2, (Number(m.ms) || 900) / 1000);
              }
              break;
            }
            case "aEnter": {
              const q = m.player as ArenaBoardRow & {
                x?: number; y?: number; z?: number; ry?: number; weapon?: string;
              };
              setArenaHud((h) => ({
                ...h,
                board: [...h.board.filter((b) => b.id !== q.id), q],
              }));
              if (q.bot) {
                addRemote(
                  q.id,
                  {
                    x: Number(q.x) || 0,
                    y: Number(q.y) || 0,
                    z: Number(q.z) || 0,
                    ry: Number(q.ry) || 0,
                    name: q.name,
                    authed: false,
                  },
                  q.dog ? "dog" : "soldier",
                );
                const br = remotes.get(q.id);
                if (br && !q.dog) {
                  setHandWeapon(br.avatar, String(q.weapon ?? "pistol"));
                }
                pushFeed(
                  q.dog
                    ? `🐕 ${q.name} ကွင်းထဲ ဝင်လာပြီ`
                    : `🏴‍☠️ ${q.name} ကွင်းထဲ ဝင်လာပြီ`,
                  false,
                );
              }
              break;
            }
            case "aLeave":
              setArenaHud((h) => ({
                ...h,
                board: h.board.filter((b) => b.id !== m.id),
              }));
              // Bot avatar က presence leave မလာဘူး — ဒီကနေပဲ ဖြုတ်တယ်
              if (String(m.id).startsWith("bot:")) dropRemote(String(m.id));
              break;
            case "aMove": {
              // 🏴‍☠️ Bot တွေရဲ့ ရွေ့လျားမှု — လူသားတွေက presence update နဲ့
              // လာပြီးသားမို့ bot id တွေကိုပဲ ဒီကနေ မောင်းတယ် (remotes ရဲ့
              // target-lerp စနစ်အတိုင်း ချောချော ရွေ့တယ်)။
              if (!String(m.id).startsWith("bot:")) break;
              const br = remotes.get(String(m.id));
              if (!br) break;
              br.target.x = Number(m.x) || 0;
              br.target.y = Number(m.y) || 0;
              br.target.z = Number(m.z) || 0;
              br.target.ry = Number(m.ry) || 0;
              break;
            }
            case "aHit": {
              // ထိခံရသူ (remote) နေရာမှာ မီးပွား + ကွင်းနီ — ဘယ်သူထိလဲ
              // မျက်စိနဲ့ မြင်သာအောင် (ကိုယ်ပစ်တာ မဟုတ်လည်း ပြတယ်)
              const vr = remotes.get(String(m.victimId));
              if (vr) {
                combatFx?.impact(
                  new THREE.Vector3(vr.cur.x, vr.cur.y + 1.1, vr.cur.z),
                );
                combatFx?.ring(vr.cur.x, vr.cur.z, 0xff5544, 0.45);
              }
              if (m.attackerId === myId) {
                // ကိုယ့် friend NPC ကို ပစ်မိရင် server ဘက်မှာ မိတ်ဆွေပျက်တယ်
                botFriends.delete(String(m.victimId));
                sfx?.hitMarker(m.hitPart === "head");
                buzz(m.hitPart === "head" ? [20, 20, 30] : 25);
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
                buzz(45);
                // 🏴‍☠️ ဓားပြက ပစ်လာရင် မြန်မာသံ ကြိမ်းမောင်း (throttle ပါ)
                if (String(m.attackerId).startsWith("bot:")) voice?.say("taunt");
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
            }
            case "aKill": {
              // Bot သေရင် friendship ပျက်တယ် (server respawn က ရှင်းတယ်) —
              // context ခလုတ် ပြန်ပေါ်နိုင်အောင် ဒီဘက်မှာလည်း ဖျက်
              botFriends.delete(String(m.victimId));
              // သေဆုံးသူ (remote) နေရာမှာ ကွင်းနီကြီး — kill motion graphic
              const kr = remotes.get(String(m.victimId));
              if (kr) combatFx?.ring(kr.cur.x, kr.cur.z, 0x991111, 1.3);
              // 🎖 Rigged avatar သေဟန် — die clip ပြပြီး ခဏ အလောင်းပုံ
              // ဆက်ထား (respawn teleport မတိုင်ခင်)
              {
                const dieClip = (
                  m.victimId === myId ? me.group : kr?.avatar.group
                )?.userData.playClip as
                  | ((name: string, holdMs?: number) => void)
                  | undefined;
                dieClip?.("die", 1500);
              }
              // 🏴‍☠️ ဓားပြပါတဲ့ kill က assassin အမှတ်မထိ — "လူမှား ✗" မပြရ
              const anyBot = m.victimBot === true || m.killerBot === true;
              pushFeed(
                anyBot
                  ? `${m.killerName} → ${m.victimName} 🏴‍☠️`
                  : `${m.killerName} → ${m.victimName}${m.correct === true ? " ✓" : " ✗ (လူမှား)"}`,
                m.correct === true || m.victimBot === true,
              );
              if (m.killerId === myId) {
                sfx?.kill(m.correct === true || m.victimBot === true);
                buzz(m.correct === true || m.victimBot === true ? [30, 40, 70] : [80]);
                voice?.say(
                  m.correct === true || m.victimBot === true ? "kill" : "wrongKill",
                );
                flashBanner(
                  m.victimBot === true
                    ? `🏴‍☠️ ${m.victimName} ကို နှိမ်လိုက်ပြီ — လက်နက် ကျသွားတယ်`
                    : m.correct === true
                      ? `☠️ ${m.victimName} ကို သတ်လိုက်ပြီ!`
                      : `✗ လူမှားသွားပြီ — ${m.victimName}`,
                  m.correct === true || m.victimBot === true ? "good" : "bad",
                );
              } else if (m.victimId === myId) {
                sfx?.hurt();
                buzz(140);
                voice?.say("death");
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
            }
            case "aRespawn":
              if (m.id === myId) {
                p.x = Number(m.x);
                p.z = Number(m.z);
                sfx?.reload();
                combatFx?.ring(p.x, p.z, 0x4ade80);
                voice?.say("respawn");
                flashBanner("💚 ပြန်ရှင်ပြီ — သတိထား", "good");
              } else if (String(m.id).startsWith("bot:")) {
                // Bot ပြန်ရှင်ချိန် — အလောင်းနေရာကနေ spawn ကို ချက်ချင်း ခုန်
                const br = remotes.get(String(m.id));
                if (br) {
                  br.cur.x = br.target.x = Number(m.x) || 0;
                  br.cur.z = br.target.z = Number(m.z) || 0;
                  combatFx?.ring(br.cur.x, br.cur.z, 0x4ade80);
                }
              }
              break;
            case "aDrop": {
              // 🔫 မြေပေါ် လက်နက်ကျမှု — လှည့်နေတဲ့ mesh (tick မှာ spin)
              const did = Number(m.id);
              if (!Number.isFinite(did) || dropMeshes.has(did)) break;
              const g = buildWeaponMesh(String(m.weapon || "pistol"));
              g.position.set(Number(m.x) || 0, 0.55, Number(m.z) || 0);
              g.scale.setScalar(1.4);
              scene.add(g);
              dropMeshes.set(did, g);
              break;
            }
            case "aDropGone":
              removeDrop(Number(m.id));
              break;
            case "aPickup": {
              // ကိုယ်ကောက်မိတဲ့ ကျည် — toast + အသံ + တုန်ခါမှု
              const wk = String(m.weapon || "");
              sfx?.reload();
              buzz(20);
              voice?.say("pickup");
              pushFeed(
                `🔫 ${wNames[wk] ?? wk} ကျည် +${Number(m.gained) || 0} ကောက်ရပြီ`,
                true,
              );
              break;
            }
            case "aBotMood":
              if (m.mood === "friend") {
                if (m.of === myId) {
                  botFriends.add(String(m.id));
                  buzz([20, 30, 20]);
                  // 🗣 NPC က မြန်မာသံနဲ့ တုံ့ပြန် (ခွေးက အသံမပြော)
                  if (m.dog !== true) voice?.say("befriend");
                  flashBanner(
                    m.dog === true
                      ? `🐕 ${m.name} က မင်းကို ခင်သွားပြီ — ရန်သူကို ဝိုင်းကိုက်ပေးမယ်`
                      : `🤝 ${m.name} နဲ့ မိတ်ဆွေဖြစ်ပြီ — မင်းကို ကူညီမယ်`,
                    "good",
                  );
                } else {
                  pushFeed(`🤝 ${m.name} က မိတ်ဆွေရသွားပြီ`, true);
                }
              } else if (m.mood === "none") {
                // ★ မိတ်ဆွေဖွဲ့ မအောင်တဲ့ feedback — အရင်က ဘာမှ မပြလို့
                // "🤝 ခလုတ် အလုပ်မလုပ်ဘူး" လို့ ထင်ကြတယ် (report)
                flashBanner(
                  m.reason === "grudge"
                    ? "😠 ဒီ NPC က မင်းကို ရန်ငြိုးထားနေတုန်း — ခဏနေမှ ပြန်ကြိုးစားပါ"
                    : m.reason === "far"
                      ? `🤝 NPC နဲ့ ဝေးနေသေးတယ် (${Number(m.dist) || "?"}m) — ကပ်ပြီးမှ လက်ပြပါ`
                      : "🤝 အနီးမှာ မိတ်ဆွေဖွဲ့လို့ရတဲ့ NPC မရှိသေးဘူး",
                  "bad",
                );
              }
              break;
            case "aWin":
              sfx?.win();
              buzz([40, 60, 40, 60, 120]);
              flashBanner(
                m.winnerId === myId
                  ? "🏆 မင်း အနိုင်ရပါပြီ!"
                  : `🏆 ${m.winnerName} အနိုင်ရပါပြီ`,
                "good",
              );
              if (m.winnerId === myId) voice?.say("win");
              break;
            case "aReset":
              botFriends.clear(); // ပွဲအသစ် — friendship တွေ ပြန်စ
              setArenaHud((h) => ({
                ...h,
                board: (m.players as ArenaBoardRow[]) ?? [],
              }));
              teleportMe(m.players);
              flashBanner("🔔 ပွဲအသစ် စပါပြီ", "good");
              voice?.say("start");
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
          // 🎖 TP မှာ ကိုယ့် rigged body ရဲ့ ပစ်ဟန်/ဝှေ့ဟန် one-shot
          // (FP မှာ body ဖျောက်ထားလို့ အလကား — ဒါပေမယ့် ခေါ်လည်း မထိခိုက်)
          (me.group.userData.playClip as
            | ((name: string, holdMs?: number) => void)
            | undefined)?.(
            combat.weapon === "knife" ? "attack-melee-right" : "holding-right-shoot",
          );
          if (combat.weapon === "knife") {
            // 🔪 ဓားက ဝှေ့တာ — ကျည်လမ်းကြောင်း/ပြောင်းဝမီး မထွက်ရဘူး
            swingT = 0.25;
          } else {
            combatFx?.tracer(eye.clone().addScaledVector(d, 0.9), d, 40);
            combatFx?.muzzle(eye.clone().addScaledVector(d, 0.9));
          }
          // Recoil — ကင်မရာ အပေါ်ခုန် + ဘေးယိမ်းအနည်းငယ် (PUBG-style)
          const rec = RECOIL[combat.weapon] ?? 0.012;
          cam.pitch = THREE.MathUtils.clamp(cam.pitch - rec, -1.2, 1.2);
          cam.yaw += (Math.random() - 0.5) * rec * 0.6;
          vmKick = 0.07;
          buzz(12);
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
        // ★ ယာဉ်ဘေးမှာ ချတယ် — ဒါပေမယ့် အဲဒီနေရာက အဆောက်အအုံ collider
        //   ထဲဆိုရင် တခြားဘက်တွေ စမ်းတယ်။ Collider ထဲ ချမိရင် ကစားသမား
        //   ကပ်နေတယ် (resolveCollision ရဲ့ unstick က ကယ်ပေမယ့် မချမိတာ
        //   အကောင်းဆုံး)။
        const ry0 = riding.state.ry;
        let px = riding.state.x + Math.cos(ry0) * 1.8;
        let pz = riding.state.z - Math.sin(ry0) * 1.8;
        for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
          if (!insideCollider(px, pz, world.colliders)) break;
          px = riding.state.x + Math.cos(ry0 + a) * 1.8;
          pz = riding.state.z - Math.sin(ry0 + a) * 1.8;
        }
        p.x = px;
        p.z = pz;
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
          fpvRef.current || map.id === "arena" ? -1.2 : -0.25,
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
        fpvRef.current || map.id === "arena" ? -1.2 : -0.25,
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
    // ★ တစ်ခါတည်း မဟုတ်ဘဲ **မိနစ်တိုင်း ပြန်စစ်တယ်** — ကိုယ်ဝင်ပြီးမှ
    //   စလွှင့်တဲ့ live ကို screen က မိရမယ်၊ ပြီးသွားတဲ့ live ကိုလည်း
    //   placeholder ပြန်ပြရမယ် (အရင်က ဝင်ချိန် တစ်ခါပဲ စစ်လို့ မမိဘူး)။
    const pollBoard = () => {
      void fetch("/api/metaverse/board", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            data: {
              posts?: { author: string; text: string }[];
              live?: {
                id?: string | null;
                title?: string | null;
                url: string | null;
              } | null;
            } | null,
          ) => {
            if (killed || !data || !world.screenMesh) return;
            landmarks.setNotices(data.posts ?? []);
            const url = data.live?.url ?? "";
            const lkId = !url && data.live?.id ? String(data.live.id) : "";
            if (url && url !== liveUrl) {
              // IVS live — screen မှာ HLS နဲ့ တိုက်ရိုက် ဖွင့်တယ်
              screen?.dispose();
              screen = attachLiveScreen(world.screenMesh, url);
              liveUrl = url;
            } else if (lkId && liveUrl !== `lk:${lkId}`) {
              // 📱 LiveKit (ဖုန်း Go Live) — SFU ကို ကြည့်သူအဖြစ် ချိတ်ပြီး
              // host ရဲ့ video ကို screen မှာ တိုက်ရိုက်ပြ (phase 2b)။
              // ချိတ်မရရင် (guest စသဖြင့်) placeholder ကျန်နေတယ်။
              screen?.dispose();
              screen = attachLiveKitScreen(
                world.screenMesh,
                lkId,
                `${String(data.live?.title ?? "LIVE").slice(0, 40)}`,
              );
              liveUrl = `lk:${lkId}`;
            } else if (!url && !data.live && liveUrl) {
              // Live ပြီးသွားပြီ — default (env URL ဒါမှမဟုတ် placeholder) ပြန်ထား
              screen?.dispose();
              screen = attachLiveScreen(world.screenMesh, IVS_URL);
              liveUrl = "";
            }
          },
        )
        .catch(() => {
          /* သင်ပုန်း ဗလာနေရုံပဲ — လောကက ဆက်လည်တယ် */
        });
    };
    pollBoard();
    const boardTimer = window.setInterval(pollBoard, 60000);

    // ── Render loop ───────────────────────────────────────────────────────
    const frameClock = new THREE.Clock();
    let raf = 0;
    let frames = 0;
    let fpsAcc = 0;
    let hudAcc = 0;
    /// ရေလှိုင်း/မီးအတွက် တိုးနေတဲ့ အချိန် (နာရီနဲ့ မဆိုင်ဘူး)
    let effectT = 0;
    let nearId: string | null = null;
    let npcNearName: string | null = null;

    /// 🔋 Eco mode ရဲ့ 30fps ကန့်အတွက် နောက်ဆုံး render ချိန်
    let lastEcoFrame = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // 🔋 Eco — frame ကျော်တယ် (dt က getDelta မို့ ကျော်ထားတဲ့အချိန်က
      // နောက် frame ထဲ စုဝင်လာလို့ ရွေ့လျားနှုန်း မမှားဘူး)။
      if (ecoRef.current) {
        const nowMs = performance.now();
        if (nowMs - lastEcoFrame < 31) return;
        lastEcoFrame = nowMs;
      }
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

      // ── ခုန် + 🏢 platform ကြမ်းပြင် ────────────────────────────────────
      // ★ groundY က ခြေအောက်က အမြင့်ဆုံး ကြမ်းပြင် (မြေပြင် 0 သို့မဟုတ်
      //   platform) — လှေကားတက်တာ (step-up ≤0.5), အစွန်းကနေ လျှောက်ထွက်ရင်
      //   ကျတာ, အပေါ်ကနေ ကျရင် platform ပေါ် နားတာ အားလုံး ဒီတစ်တန်ဖိုးက
      //   စီမံတယ်။
      const groundY = riding ? 0 : world.groundAt(p.x, p.z, p.y);
      if (input.jump && !p.airborne) {
        p.vy = JUMP_V;
        p.airborne = true;
      }
      if (p.airborne) {
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;
        if (p.vy <= 0 && p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.airborne = false;
        }
      } else if (!riding) {
        if (groundY > p.y) {
          // လှေကားအဆင့် — ချောချောတက်
          p.y = groundY;
        } else if (p.y > groundY + 0.02) {
          // အစွန်းကျော်လျှောက် — လွတ်ကျ
          p.airborne = true;
          p.vy = 0;
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
      // 💥 ဗုံးလွင့်စင်မှု — input နဲ့မဆိုင်ဘဲ တွန်းတယ်၊ collision လည်း စစ်တယ်
      if (!riding && (Math.abs(kb.x) > 0.05 || Math.abs(kb.z) > 0.05)) {
        const kSolved = resolveCollision(
          p.x + kb.x * dt,
          p.z + kb.z * dt,
          p.x,
          p.z,
          world.colliders,
          world.walkRadius,
        );
        p.x = kSolved.x;
        p.z = kSolved.z;
        const decay = Math.exp(-5 * dt);
        kb.x *= decay;
        kb.z *= decay;
      }
      // ── မျက်နှာမူရာ — ရုတ်တရက်မလှည့်ဘဲ ချောချောလှည့် ──────────────────
      // ★ First-person မှာ CS လိုပဲ **ကင်မရာဘက်ကို အမြဲ** မျက်နှာမူတယ် —
      //   A/D က strafe (ဘေးတိုး) ဖြစ်ပြီး ကိုယ်လုံးက မလှည့်ဘူး။ ဒါမှ
      //   တခြားသူတွေနဲ့ voice listener က မှန်တဲ့ ဦးတည်ရာ ရတယ်။
      if (!riding) {
        // ⚔️ Arena — third-person မှာလည်း **ချိန်ရာဘက် အမြဲမျက်နှာမူ**
        // (PUBG convention)။ မဟုတ်ရင် joystick အောက်ဆွဲတိုင်း ကိုယ်လုံးက
        // ကင်မရာဘက် ၁၈၀° လှည့်ပြေးလာလို့ "လမ်းလျှောက်တာ ပြောင်းပြန်" ဖြစ်တယ်။
        const targetRy =
          fpvRef.current || map.id === "arena"
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
      // မျက်နှာမူရာနဲ့ ရွေ့ရာ ဆန့်ကျင်နေရင် (back-pedal) ခြေလှမ်း ပြောင်းပြန်
      const backpedal =
        speed > 0 && Math.sin(p.ry) * dirX + Math.cos(p.ry) * dirZ < -0.1;
      me.update(dt, {
        speed,
        running,
        airborne: p.airborne,
        emote: emoteRef.current,
        backward: backpedal,
        armed: map.id === "arena",
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
            armed: map.id === "arena",
            // သူလည်း back-pedal ဖြစ်နိုင်တယ် — ရွေ့ရာနဲ့ မျက်နှာမူရာ ဆန့်ကျင်ရင်
            backward:
              dist > 0.02 &&
              Math.sin(r.cur.ry) * dx + Math.cos(r.cur.ry) * dz < -0.01,
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
        // ⚔️ Arena — လမ်းလျှောက်ရင် head-bob အနည်းငယ် (movement ခံစားချက်)
        walkT += dt * speed;
        const bob =
          map.id === "arena" && speed > 0.3
            ? Math.sin(walkT * 2) * 0.03 * Math.min(1, speed / 8)
            : 0;
        const eyeY = p.y + 1.55 - 0.55 * crouchLerp + bob;
        camera.position.set(p.x, eyeY, p.z);
        camera.lookAt(
          p.x + Math.sin(cam.yaw) * cp,
          eyeY - Math.sin(cam.pitch),
          p.z + Math.cos(cam.yaw) * cp,
        );
      } else if (map.id === "arena" && !riding) {
        // ⚔️ Arena third-person — **over-shoulder** (PUBG standard)။
        // ★ ရိုးရိုး TP လို ကင်မရာက player ကို တည့်တည့်ကြည့်ရင် crosshair က
        //   ကိုယ့် avatar ပေါ် ကျနေပြီး တခြား player ကို ချိန်လို့မရဘူး —
        //   ညာပခုံးဘက် 0.75 ရွှေ့ပြီး pitch အတိုင်း ရှေ့ကို ချိန်တယ်။
        const dist = cam.dist;
        const sx = Math.cos(cam.yaw) * 0.75;
        const sz = -Math.sin(cam.yaw) * 0.75;
        camera.position.set(
          p.x + sx - Math.sin(cam.yaw) * cp * dist,
          p.y + 1.55 + Math.sin(cam.pitch) * dist,
          p.z + sz - Math.cos(cam.yaw) * cp * dist,
        );
        camera.lookAt(
          p.x + sx + Math.sin(cam.yaw) * cp * 6,
          p.y + 1.45 - Math.sin(cam.pitch) * 6,
          p.z + sz + Math.cos(cam.yaw) * cp * 6,
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
        // 🔫 ရွေးထားတဲ့ လက်နက်ကို လက်ထဲကိုင် (TP) + FP viewmodel
        setHandWeapon(me, combat.weapon);
        if (vmKind !== combat.weapon) {
          vmKind = combat.weapon;
          const oldVm = vmGroup.children[0] as THREE.Group | undefined;
          if (oldVm) {
            vmGroup.remove(oldVm);
            disposeWeapon(oldVm);
          }
          vmGroup.add(buildWeaponMesh(vmKind));
        }
        vmGroup.visible = fpvRef.current;
        // ပစ်တိုင်း viewmodel နောက်ဆုတ် kick — ပြန်ပြေဖြည်းဖြည်း
        vmGroup.position.z = -0.62 + vmKick;
        vmKick *= Math.exp(-10 * dt);
        // 🔪 ဓားဝှေ့ — လက်ထဲကဓား + FP viewmodel နှစ်ခုလုံး အောက်ဝှေ့ချ
        if (swingT > 0) {
          swingT = Math.max(0, swingT - dt);
          const kSwing = Math.sin((1 - swingT / 0.25) * Math.PI);
          const hw = me.group.userData.weaponMesh as THREE.Group | undefined;
          if (hw) hw.rotation.x = -0.35 - kSwing * 1.3;
          vmGroup.rotation.x = -kSwing * 0.9;
        } else {
          const hw = me.group.userData.weaponMesh as THREE.Group | undefined;
          if (hw && hw.rotation.x !== -0.35) hw.rotation.x = -0.35;
          if (vmGroup.rotation.x !== 0) vmGroup.rotation.x = 0;
        }
        // ပြေးရင် FOV နည်းနည်းကျယ် — အရှိန်ခံစားချက် (PUBG sprint feel)
        const targetFov = adsRef.current
          ? ADS_FOV[combat.weapon] ?? 45
          : BASE_FOV + (running ? 5 : 0);
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
      // 🔫 မြေပေါ်က drop လက်နက်တွေ — လှည့် + မျောနေတဲ့ bob (ကောက်လို့ရ
      // မှန်း မြင်သာအောင်)
      if (dropMeshes.size > 0) {
        dropSpinT += dt;
        for (const g of dropMeshes.values()) {
          g.rotation.y += dt * 2.2;
          g.position.y = 0.55 + Math.sin(dropSpinT * 2.4) * 0.09;
        }
      }

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
        // 🤝 Arena — မိတ်ဆွေဖွဲ့လို့ရတဲ့ NPC အနီး ရောက်/ထွက် စစ်တယ်
        // (server FRIEND_RANGE=5 နဲ့ တစ်ထပ်တည်း — ခလုတ်ပေါ်ရင် အောင်ရမယ်)
        if (map.id === "arena") {
          let bn: string | null = null;
          let bd = 5;
          for (const [rid, r] of remotes) {
            if (!rid.startsWith("bot:") || botFriends.has(rid)) continue;
            const d = Math.hypot(r.cur.x - p.x, r.cur.z - p.z);
            if (d < bd) {
              bd = d;
              bn = r.name;
            }
          }
          if (bn !== npcNearName) {
            npcNearName = bn;
            setNpcNear(bn);
          }
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
      window.clearInterval(boardTimer);
      // 🔴 Room ပြောင်း/ထွက်ရင် live ကို သေချာ ရပ် — မရပ်ရင် feed မှာ
      // သေနေတဲ့ live post ကျန်နေမယ်
      void mvGoLive.stop();
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
      scanFaces.dispose();
      nametags?.dispose();
      weather.dispose();
      gameFx.dispose();
      for (const id of [...dropMeshes.keys()]) removeDrop(id);
      combatFx?.dispose();
      sfx?.dispose();
      voice?.dispose();
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
          {/* ချိန်ကွင်း — လက်နက်အလိုက် ပုံစံကွဲ + ADS မှာ ကျဉ်း။
              Sniper scope ဖွင့်ထားချိန် scope ရဲ့ ချိန်မျဉ်းကပဲ တာဝန်ယူတယ်။ */}
          {!(ads && arenaHud.you?.weapon === "sniper") && (
            <ArenaCrosshair weapon={arenaHud.you?.weapon ?? "pistol"} ads={ads} />
          )}
          {/* 🎯 ADS (sniper မဟုတ်တဲ့ လက်နက်) — အနားတွေ မှိန် (iron-sight ခံစားချက်) */}
          {ads && arenaHud.you?.weapon !== "sniper" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[7]"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.45) 100%)",
              }}
            />
          ) : null}
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
          {/* 🎯 Sniper scope — realistic: မြင်ကွင်းက ကျယ်ကျယ်လင်းလင်း၊
              အနားသား soft + မှန် tint ပါးပါး + mil-dot ချိန်မျဉ်း။
              (အရင် version က အကွက်သေးပြီး အပြင်မဲကြီးမို့ view တစ်ခုလုံး
              မဲနေတယ်ဆိုတဲ့ report) */}
          {ads && arenaHud.you?.weapon === "sniper" ? (
            <div className="pointer-events-none absolute inset-0 z-[9]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at center, transparent 0 41vmin, rgba(0,0,0,0.55) 42vmin, rgba(0,0,0,0.94) 47vmin)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(140,180,255,0.04) 0 30vmin, rgba(0,0,0,0.18) 39vmin, transparent 41.5vmin)",
                }}
              />
              {/* ချိန်မျဉ်း ပါးပါး + mil-dots */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80"
                style={{ width: "82vmin", height: 1.5 }}
              />
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80"
                style={{ width: 1.5, height: "82vmin" }}
              />
              {[-18, -9, 9, 18].map((v) => (
                <div
                  key={`h${v}`}
                  className="absolute left-1/2 top-1/2 rounded-full bg-black/80"
                  style={{
                    width: 5,
                    height: 5,
                    transform: `translate(calc(-50% + ${v}vmin), -50%)`,
                  }}
                />
              ))}
              {[-18, -9, 9, 18].map((v) => (
                <div
                  key={`v${v}`}
                  className="absolute left-1/2 top-1/2 rounded-full bg-black/80"
                  style={{
                    width: 5,
                    height: 5,
                    transform: `translate(-50%, calc(-50% + ${v}vmin))`,
                  }}
                />
              ))}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
                style={{ width: 4, height: 4 }}
              />
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
            {/* ★ Compact strip — ဖုန်း landscape မှာ ဒုတိယတန်း ချိုးမကျအောင်
                padding/gap လျှော့ပြီး ဖောက်ထွင်းအောင် bg လျှော့ (screenshot
                report: လက်နက်တန်းက မြင်ကွင်း ကွယ်တယ်) */}
            <div className="flex max-w-[96vw] flex-wrap items-center justify-center gap-1">
              {Object.entries(arenaHud.weapons).map(([key, w], i) => (
                <button
                  key={key}
                  data-hud="1"
                  onClick={() => arenaWeaponPickRef.current?.(key)}
                  className={`pointer-events-auto flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-0.5 backdrop-blur ${
                    arenaHud.you?.weapon === key
                      ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                      : "border-white/10 bg-black/35 text-white/60 hover:bg-black/60"
                  }`}
                >
                  <WeaponIcon kind={key} />
                  <span className="text-[9px] leading-none">
                    {i < 7 ? `${i + 1}·` : ""}
                    {w.my}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Kill feed — ★ minimap (right-3 top-3, 132px) အောက်ကို ရွှေ့ပြီး
              ပိုသေး/ပိုဖောက်ထွင်း — အရင် top-20 မှာ minimap နဲ့ ထပ်နေပြီး
              စာတန်းကြီးတွေက မြင်ကွင်း ကွယ်တယ် (screenshot report)။
              International standard: killfeed က ဖတ်ရုံသေးသေး၊ w-fit၊
              ညာကပ်။ */}
          <div className="pointer-events-none absolute right-2 top-[168px] z-10 flex w-48 flex-col items-end space-y-0.5">
            {arenaHud.feed.slice(-4).map((f) => (
              <p
                key={`${f.at}-${f.text}`}
                className={`w-fit max-w-full rounded bg-black/35 px-1.5 py-0.5 text-[10px] leading-snug backdrop-blur ${
                  f.good ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {f.text}
              </p>
            ))}
          </div>
          {/* ❤️ အသက် bar (%) + ကျည် + အမှတ် — ဖတ်ရုံသက်သက် (အောက်ဗဟို)။
              ★ Bar မပါရင် "ဘယ်အချိန်သေမလဲ မသိ" (report) — % နဲ့ အရောင်
              (စိမ်း>၆၀၊ ဝါ>၃၀၊ နီ) နဲ့ တစ်ချက်ကြည့်တာနဲ့ သိရတယ်။ */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
            {arenaHud.you ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">❤️</span>
                  <div className="h-3 w-36 overflow-hidden rounded-full border border-white/25 bg-black/60">
                    <div
                      className={`h-full transition-all duration-300 ${
                        arenaHud.you.hp > 60
                          ? "bg-emerald-400"
                          : arenaHud.you.hp > 30
                            ? "bg-amber-400"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, arenaHud.you.hp))}%` }}
                    />
                  </div>
                  <span
                    className={`rounded bg-black/60 px-1.5 py-0.5 text-xs backdrop-blur ${
                      arenaHud.you.hp <= 30 ? "text-red-300" : "text-white/90"
                    }`}
                  >
                    {Math.max(0, arenaHud.you.hp)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="rounded bg-black/60 px-2 py-0.5 text-white/80 backdrop-blur">
                    {(() => {
                      const y = arenaHud.you;
                      const n = y.ammo?.[y.weapon];
                      const label = arenaHud.weapons[y.weapon]?.my ?? y.weapon;
                      return `${label} · ${n === -1 || n === undefined || n === null ? "∞" : n}`;
                    })()}
                  </span>
                  <span className="rounded bg-black/60 px-2 py-0.5 text-amber-200/90 backdrop-blur">
                    🎯 {arenaHud.you.score} · ☠️ {arenaHud.you.kills}
                  </span>
                </div>
              </>
            ) : (
              <span className="rounded bg-black/60 px-2.5 py-1 text-xs text-white/60 backdrop-blur">
                ⚔️ ပွဲထဲ ချိတ်နေသည်…
              </span>
            )}
          </div>
          {/* ★★ Combat ခလုတ်များ — **တစ်ခုချင်း absolute နေရာချ**။ အရင်က
              ညာဘက် cluster တစ်ခုတည်း စုထားလို့ landscape မှာ minimap/Menu/
              ပိုင်ဆိုင်မှု chip တွေနဲ့ ထပ်ပြီး 🔫 က မျက်နှာပြင်စွန်း
              ပြတ်နေတယ်။ အခုက PUBG layout:
              🔫 = ခုန်ခလုတ်ရဲ့ ဘယ် · 🔄 = 🔫 အပေါ် · 🎯 = ခုန်အပေါ် ·
              🧎 = 🔫 နဲ့ joystick ကြား — ဘာနဲ့မှ မထပ်ဘူး။ */}
          <button
            data-hud="1"
            onPointerDown={() => arenaFireHoldRef.current?.(true)}
            onPointerUp={() => arenaFireHoldRef.current?.(false)}
            onPointerLeave={() => arenaFireHoldRef.current?.(false)}
            onPointerCancel={() => arenaFireHoldRef.current?.(false)}
            aria-label="ပစ်မယ် (ဖိထားရင် ဆက်ပစ်)"
            className="pointer-events-auto absolute bottom-6 right-28 z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/70 bg-red-500/30 text-2xl backdrop-blur active:scale-95 active:bg-red-500/60"
          >
            🔫
          </button>
          <button
            data-hud="1"
            onClick={() => arenaReloadRef.current?.()}
            aria-label="ကျည်ဖြည့်မယ် (R)"
            className="pointer-events-auto absolute bottom-24 right-28 z-10 rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white/80 backdrop-blur"
          >
            🔄
          </button>
          <button
            data-hud="1"
            onClick={() => setAdsBoth(!ads)}
            aria-label="ချိန်ကွင်း (ADS)"
            className={`pointer-events-auto absolute bottom-32 right-8 z-10 rounded-full border px-3 py-2 text-sm backdrop-blur ${
              ads
                ? "border-amber-400/70 bg-amber-500/30 text-amber-200"
                : "border-white/20 bg-black/50 text-white/80"
            }`}
          >
            🎯
          </button>
          <button
            data-hud="1"
            onClick={() => {
              setCrouchOn((c) => {
                crouchSetRef.current?.(!c);
                return !c;
              });
            }}
            aria-label="ကုပ်မယ်"
            className={`pointer-events-auto absolute bottom-6 right-[11.5rem] z-10 rounded-full border px-3 py-2 text-sm backdrop-blur ${
              crouchOn
                ? "border-emerald-400/70 bg-emerald-500/30 text-emerald-200"
                : "border-white/20 bg-black/50 text-white/80"
            }`}
          >
            🧎
          </button>
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

          {/* Event feed — arena killfeed နဲ့ တူတူ: minimap အောက်၊ သေးပြီး
              ဖောက်ထွင်း (မြင်ကွင်း မကွယ်စေနဲ့) */}
          <div className="pointer-events-none absolute right-2 top-[168px] z-10 flex w-48 flex-col items-end space-y-0.5">
            {hideHud.feed.slice(-4).map((f) => (
              <p
                key={`${f.at}-${f.text}`}
                className={`w-fit max-w-full rounded bg-black/35 px-1.5 py-0.5 text-[10px] leading-snug backdrop-blur ${
                  f.good ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {f.text}
              </p>
            ))}
          </div>

          {/* 🖐 ဖမ်းခလုတ် — ခုန်ခလုတ်ရဲ့ ဘယ် (arena ရဲ့ 🔫 နေရာနဲ့ တူညီ)။
              🏆/📣/🏙 တွေက ဘယ်အပေါ်တန်းမှာ (game rooms မျှသုံး)။ */}
          {hideHud.role === "seeker" && hideHud.phase === "live" ? (
            <button
              data-hud="1"
              onClick={() => hideTagRef.current?.()}
              className="pointer-events-auto absolute bottom-6 right-28 z-10 rounded-full border-2 border-amber-400/70 bg-amber-500/30 px-6 py-4 text-xl backdrop-blur active:scale-95 active:bg-amber-500/60"
            >
              🖐 ဖမ်းမယ်
            </button>
          ) : null}
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
          <p className="mb-1 text-center text-xs font-semibold text-white/90">
            🏆 အမှတ်စာရင်း
          </p>
          {roomId === "arena" ? (
            <p className="mb-2 text-center text-[10px] text-white/55">
              ပထမဆုံး {arenaHud.killsToWin} မှတ် ရသူ နိုင်သည်
              {arenaHud.you
                ? ` · မင်း — ☠️${arenaHud.you.kills} ✗${arenaHud.you.wrongKills ?? 0}`
                : ""}
            </p>
          ) : null}
          <div className="space-y-1">
            {(roomId === "arena"
              ? [...arenaHud.board]
                  .sort((a, b) => b.score - a.score)
                  .map((r) => ({
                    id: r.id,
                    name: r.name,
                    score: r.score,
                    dead: !r.alive,
                    bot: r.bot === true,
                    dog: r.dog === true,
                  }))
              : [...hideHud.players]
                  .sort((a, b) => b.score - a.score)
                  .map((r) => ({
                    id: r.id,
                    name: r.name,
                    score: r.score,
                    dead: false,
                    bot: false,
                    dog: false,
                  }))
            ).map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center justify-between rounded px-2 py-1 text-[12px] ${
                  r.id === meId ? "bg-emerald-500/15 text-emerald-200" : "text-white/85"
                }`}
              >
                <span className="truncate">
                  {i + 1}. {r.dog ? "🐕 " : r.bot ? "🏴‍☠️ " : ""}
                  {r.name}
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

      {/* ── 📜 ပြိုင်ပွဲစည်းမျဉ်း / user guide — game room များအတွက် ── */}
      {showRules && inGameRoom ? (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-30 max-h-[80vh] w-80 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/15 bg-black/85 p-4 text-[12px] leading-relaxed text-white/90 backdrop-blur">
          {roomId === "arena" ? (
            <>
              <p className="mb-2 text-center text-sm font-bold text-amber-300">
                ⚔️ Assassin ပြိုင်ပွဲ စည်းမျဉ်းများ
              </p>
              <div className="space-y-1.5">
                <p>🎯 <b>လျှို့ဝှက်ပစ်မှတ်</b> — ကစားသမားတိုင်းမှာ ကိုယ့်ပစ်မှတ် တစ်ယောက်စီ ရှိတယ်။ မင်းရဲ့ပစ်မှတ်ကို အပေါ်မှာ ပြထားပြီး <b>မင်းကို ဘယ်သူလိုက်နေလဲတော့ မသိရဘူး</b>။</p>
                <p>✅ မှန်တဲ့ပစ်မှတ်ကို သတ်ရင် <b>+၁ မှတ်</b> — ပစ်မှတ်အသစ် ချက်ချင်းရမယ်။</p>
                <p>❌ လူမှားသတ်ရင် <b>−၁ မှတ်</b> — မိမိကို ပစ်လာသူကိုတော့ ပြန်ခုခံလို့ရတယ်။</p>
                <p>🏆 <b>ပထမဆုံး {arenaHud.killsToWin} မှတ်</b> ရသူ နိုင်တယ် — ပြီးရင် ခဏအတွင်း ပွဲအသစ် ပြန်စတယ်။</p>
                <p>💀 သေရင် <b>၄ စက္ကန့်</b>အတွင်း နေရာအသစ်မှာ hp အပြည့်နဲ့ ပြန်ရှင်တယ်။</p>
                <p>🔫 <b>လက်နက် ၇ မျိုး</b> — ပစ္စတို (မျှတ) · ဓား (အနီးကပ်၊ ကျည်မကုန်) · စနိုက်ပါ (အဝေး + scope) · ဗုံး (ဧရိယာပေါက်ကွဲ) · SMG (အမြန်ပစ်) · သေနတ်ကြီး (အနီး အပြင်းဆုံး) · ရီဗော်လ်ဗာ (ခေါင်းထိ တစ်ချက်သေ)။</p>
                <p>🎯 ခေါင်းထိချက် ဒဏ် ၂ ဆ — 🎯 ချိန်ကွင်း (ADS) နဲ့ ပိုတိကျအောင် ချိန်ပါ။</p>
                <p>🏴‍☠️ <b>ဓားပြ NPC ၃ ယောက်</b> — ပုံမှန် ငြိမ်းချမ်းစွာ လှည့်နေတယ်၊ <b>မင်းက စပစ်မှသာ</b> ရန်ငြိုးထားပြီး ပြန်တုံ့ပြန်တယ် (ခဏနေရင် မေ့တယ်)။ သတ်ရင် အမှတ်မထိဘဲ <b>လက်နက် ကျတယ်</b>။</p>
                <p>🔫 <b>ကျတဲ့လက်နက်</b> (လှည့်နေတဲ့ လက်နက်) ဘေးကပ်ရင် အလိုအလျောက် ကောက်ပြီး ကျည်ရတယ် — စက္ကန့် ၃၀ အတွင်း မကောက်ရင် ပျောက်တယ်။</p>
                <p>🤝 <b>ဓားပြနဲ့ မိတ်ဆွေဖွဲ့</b> — အနားကပ်ပြီး 🤝 (လက်ပြ) နှိပ်ရင် friend ဖြစ်တယ်။ Friend bot က နောက်ကလိုက်ပြီး မင်းကို ပစ်သူကို ပြန်ကူပစ်ပေးတယ် — သူ့ကို ပြန်ပစ်မိရင် မိတ်ဆွေပျက်တယ်။</p>
                <p>🐕 <b>ခွေးရိုင်း ၂ ကောင်</b> — ငြိမ်းချမ်းစွာ လှည့်နေတယ်၊ ပစ်မိမှသာ ပြန်ကိုက်တယ်။ 🤝 လက်ပြပြီး ခင်လိုက်ရင် နောက်ကလိုက်ပြီး <b>ရန်သူကို ဝိုင်းကိုက်ပေးတယ်</b>။</p>
                <p>👥 <b>အဖွဲ့နဲ့</b> — 📣 link ဖိတ် · 🏆 အမှတ်စာရင်း · chat/voice သုံးလို့ရ။</p>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-center text-sm font-bold text-emerald-300">
                🙈 ဝှက်တမ်း စည်းမျဉ်းများ
              </p>
              <div className="space-y-1.5">
                <p>👥 ကစားသမား <b>၃ ယောက်ပြည့်ရင်</b> ပွဲ အလိုအလျောက် စတယ်။</p>
                <p>🔦 တစ်ယောက်က <b>ရှာဖွေသူ</b> — စစချင်း သူ မျက်စိမှိတ်နေချိန် ကျန်သူတွေ ပုန်းရမယ်။</p>
                <p>🖐 ရှာဖွေသူက အနီးကပ်ရောက်ရင် ဖမ်းခလုတ်နဲ့ ဖမ်းတယ်။</p>
                <p>⏱ ပွဲချိန် ၅ မိနစ် — မဖမ်းမိဘဲ လွတ်နေသူတွေ အမှတ်ရတယ်။</p>
              </div>
            </>
          )}
          <button
            data-hud="1"
            onClick={() => setShowRules(false)}
            className="mt-3 w-full rounded-lg border border-white/25 bg-white/10 py-1.5 text-center text-xs hover:bg-white/20"
          >
            ပိတ်မယ်
          </button>
        </div>
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
      {/* ★ Game room မှာ top-16 — app WebView ရဲ့ ⬅ back ခလုတ်က top-left မှာ
          မြုပ်နေပြီး chip တန်းရဲ့ ပထမခလုတ်နဲ့ ထပ်နေတယ် (🏆 နှိပ်မယ်ဆိုပြီး
          back ကို မှားနှိပ် → game ထဲက ထွက်သွားတယ်)။ */}
      <div
        className={`pointer-events-none absolute bottom-40 left-3 z-20 flex flex-col items-start gap-2 ${
          inGameRoom ? "top-16" : "top-3"
        }`}
      >
      {/* ★ Game room မှာ panel box ကြီး မသုံးဘူး — status က game display ကို
          နေရာအများကြီး ယူနေတယ်ဆိုတဲ့ report အရ float chip အသေးတွေပဲ။ */}
      <div
        className={`shrink-0 select-none text-[11px] leading-relaxed text-white/80 ${
          inGameRoom ? "" : "rounded-lg bg-black/40 px-3 py-2 backdrop-blur"
        }`}
      >
        {!inGameRoom && (
          <div className="font-semibold text-emerald-300">Gwave Metaverse</div>
        )}
        {/* Game room မှာ generic လမ်းညွှန်တွေ ဖျောက် — panel ကျဉ်းမှ
            weapons strip နဲ့ မထပ်ဘူး။ Game keybind တွေက ❓ နောက်မှာ။ */}
        {!touch && !inGameRoom && (
          <>
            <div>WASD ရွှေ့ · Shift လျှောက် · Ctrl ကုပ် · Space ခုန်</div>
            <div>V မြင်ကွင်း · မောက်စ်ဆွဲ = ကင်မရာ · scroll = zoom</div>
            {fpv && <div className="text-emerald-300/80">FP: click = ကြည့်ရှုထိန်း · Esc = လွှတ်</div>}
          </>
        )}
        {touch && !inGameRoom && <div>ဘယ်ဘက် joystick · ညာဘက် ခုန်</div>}
        {/* ⚔️ Game room ခလုတ်လမ်းညွှန် — desktop မှာ keyboard, ဖုန်းမှာ ခလုတ် */}
        {roomId === "arena" && showHelp && (
          <div className="mt-1 rounded-lg bg-black/60 px-2 py-1 text-amber-200/90 backdrop-blur">
            {touch ? (
              <>
                <div>🔫 ဖိထား = ဆက်ပစ် · 🎯 ချိန်ကွင်း · 🧎 ကုပ်</div>
                <div>🔄 ကျည်ဖြည့် · အပေါ်တန်း = လက်နက်ပြောင်း</div>
                <div>ဘယ် joystick = ရွှေ့ · မျက်နှာပြင်ဆွဲ = ကြည့်</div>
              </>
            ) : (
              <>
                <div>Click ဖိထား = ဆက်ပစ် · Right-click = 🎯 ချိန်ကွင်း</div>
                <div>R = ကျည်ဖြည့် · 1-7 / လှိမ့် = လက်နက် · Q = အရင်လက်နက်</div>
                <div>Ctrl = ကုပ် · Shift = လျှောက် · Tab = အမှတ်စာရင်း</div>
              </>
            )}
          </div>
        )}
        {roomId === "hide-1" && showHelp && (
          <div className="mt-1 rounded-lg bg-black/60 px-2 py-1 text-amber-200/90 backdrop-blur">
            {touch ? "🖐 ဖမ်း · 🏆 အမှတ် · 📣 ဖိတ်" : "🖐 = ဖမ်း · Tab = အမှတ်စာရင်း"}
          </div>
        )}
        {/* ── Game room လုပ်ဆောင်ချက်တန်း — ဘယ်အပေါ် panel ထဲ စုထားတယ်။
            ★ အရင်က ညာဘက် cluster မှာ ထားလို့ landscape မှာ minimap နဲ့
              ထပ်တယ် — ဒီမှာက ဘာနဲ့မှ မထပ်ဘူး။ 👤 က metaverse avatar
              ရုပ်ပြင်ခန်း (အရောင်/အဝတ်/ကိုယ်ခန္ဓာ ရွေးချယ်မှုအပြည့်)။ */}
        {/* ★ Icon-only float ခလုတ်အသေးများ — စာတန်းပါရင် panel က game
            display ကို နေရာယူလွန်းတယ် (report)။ Icon က aria/title နဲ့။ */}
        {/* ── Game room ခလုတ်တန်း — **default ခေါက်ထား** ─────────────────
            ★ Screenshot report: chip ၁၀ လုံးတန်းက game မြင်ကွင်းကို
              ကွယ်နေတယ်။ International FPS standard (PUBG/CoD mobile) က
              persistent chrome အနည်းဆုံး — ဒါကြောင့် 🏆 + ⋯ ပဲ ချန်ပြီး
              ကျန်တာ ⋯ နောက်မှာ ဝှက်တယ်။ Live လွှင့်နေချိန်မှာတော့ 🔴 (ရပ်)
              နဲ့ 🤳 (ကင်မရာ) ကို အမြန်လက်လှမ်းမီအောင် အမြဲပြတယ်။ */}
        {(roomId === "arena" || roomId === "hide-1") && (
          <div className="pointer-events-auto flex max-w-[70vw] flex-wrap items-center gap-1">
            <button
              data-hud="1"
              onClick={() => setShowBoard((s) => !s)}
              aria-label="အမှတ်စာရင်း"
              title="အမှတ်စာရင်း"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[13px] backdrop-blur"
            >
              🏆
            </button>
            {(mvLive !== "off" || hudMore) && (
              <button
                data-hud="1"
                onClick={toggleGoLive}
                aria-label="Metaverse Go Live"
                title="Game မြင်ကွင်းကို feed ဆီ တိုက်ရိုက်လွှင့်မယ်"
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                  mvLive === "on"
                    ? "animate-pulse border-red-400/70 bg-red-500/30 text-red-200"
                    : mvLive === "starting"
                      ? "border-amber-400/60 bg-amber-500/25 text-amber-200"
                      : "border-white/20 bg-black/40"
                }`}
              >
                🔴
              </button>
            )}
            {(mvLive === "on" || hudMore) && (
              <button
                data-hud="1"
                onClick={cycleCam}
                aria-label="Live ကင်မရာ — မျက်နှာ/အနောက်/ပိတ်"
                title="Live ကင်မရာ PiP — မျက်နှာ → အနောက် → ပိတ်"
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                  mvCam === "off"
                    ? "border-white/20 bg-black/40"
                    : "border-sky-400/60 bg-sky-500/25 text-sky-200"
                }`}
              >
                {mvCam === "environment" ? "📷" : "🤳"}
              </button>
            )}
            <button
              data-hud="1"
              onClick={() => setHudMore((m) => !m)}
              aria-label={hudMore ? "ခလုတ်များ ခေါက်မယ်" : "ခလုတ်များ ဖြန့်မယ်"}
              title={hudMore ? "ခလုတ်များ ခေါက်မယ်" : "ခလုတ်များ ဖြန့်မယ်"}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                hudMore
                  ? "border-emerald-400/60 bg-emerald-500/25 text-emerald-200"
                  : "border-white/20 bg-black/40"
              }`}
            >
              {hudMore ? "✕" : "⋯"}
            </button>
            {hudMore && (
              <>
                <button
                  data-hud="1"
                  onClick={invite}
                  aria-label="အဖွဲ့ဖိတ်မယ်"
                  title="အဖွဲ့ဖိတ်မယ်"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[13px] backdrop-blur"
                >
                  📣
                </button>
                {roomId === "arena" && (
                  <button
                    data-hud="1"
                    onClick={waveBefriend}
                    aria-label="NPC နဲ့ မိတ်ဆွေဖွဲ့မယ် (လက်ပြ)"
                    title="NPC နဲ့ မိတ်ဆွေဖွဲ့မယ် (လက်ပြ) — 5m အတွင်း ကပ်ပြီးမှ"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[13px] backdrop-blur"
                  >
                    🤝
                  </button>
                )}
                <button
                  data-hud="1"
                  onClick={() => {
                    setMenu(null);
                    setDressing(true);
                  }}
                  aria-label="Avatar ရုပ်ပြင်မယ်"
                  title="Avatar ရုပ်ပြင်မယ်"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[13px] backdrop-blur"
                >
                  👤
                </button>
                <button
                  data-hud="1"
                  onClick={togglePic}
                  aria-label="Profile ဓာတ်ပုံ ပြ/ဖျောက်"
                  title="Profile ဓာတ်ပုံ ပြ/ဖျောက်"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                    showPic
                      ? "border-sky-400/60 bg-sky-500/25 text-sky-200"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  🖼
                </button>
                <button
                  data-hud="1"
                  onClick={toggleEco}
                  aria-label="ဘက်ထရီချွေတာ mode"
                  title="ဘက်ထရီချွေတာ mode — 30fps + အရိပ်ပိတ်"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                    eco
                      ? "border-lime-400/60 bg-lime-500/25 text-lime-200"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  🔋
                </button>
                <button
                  data-hud="1"
                  onClick={() => setShowRules((r) => !r)}
                  aria-label="ပြိုင်ပွဲစည်းမျဉ်း"
                  title="ပြိုင်ပွဲစည်းမျဉ်း"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                    showRules
                      ? "border-emerald-400/60 bg-emerald-500/25 text-emerald-200"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  📜
                </button>
                <button
                  data-hud="1"
                  onClick={() => setShowHelp((h) => !h)}
                  aria-label="ခလုတ်လမ်းညွှန်"
                  title="ခလုတ်လမ်းညွှန်"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] backdrop-blur ${
                    showHelp
                      ? "border-amber-400/60 bg-amber-500/25 text-amber-200"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  ❓
                </button>
                <button
                  data-hud="1"
                  onClick={() => chooseMap("city")}
                  aria-label="မြို့တော်ကို ထွက်မယ်"
                  title="မြို့တော်ကို ထွက်မယ်"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[13px] backdrop-blur"
                >
                  🏙
                </button>
              </>
            )}
          </div>
        )}
        {/* 🖼 Social room မှာလည်း profile ဓာတ်ပုံ ပြ/ဖျောက် ရွေးလို့ရရမယ် —
            game room မှာတော့ အပေါ်က chip တန်းထဲ ရှိပြီးသား */}
        {!inGameRoom && (
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              data-hud="1"
              onClick={togglePic}
              aria-label="Profile ဓာတ်ပုံ ပြ/ဖျောက်"
              title="Profile ဓာတ်ပုံ ပြ/ဖျောက်"
              className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] backdrop-blur ${
                showPic
                  ? "border-sky-400/60 bg-sky-500/25 text-sky-200"
                  : "border-white/20 bg-black/50 text-white/80"
              }`}
            >
              🖼 {showPic ? "ပုံပြထား" : "ပုံဖျောက်ထား"}
            </button>
            <button
              data-hud="1"
              onClick={toggleGoLive}
              aria-label="Metaverse Go Live"
              title="Metaverse မြင်ကွင်းကို feed ဆီ တိုက်ရိုက်လွှင့်မယ်"
              className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] backdrop-blur ${
                mvLive === "on"
                  ? "animate-pulse border-red-400/70 bg-red-500/30 text-red-200"
                  : mvLive === "starting"
                    ? "border-amber-400/60 bg-amber-500/25 text-amber-200"
                    : "border-white/20 bg-black/50 text-white/80"
              }`}
            >
              🔴 {mvLive === "on" ? "LIVE — ရပ်မယ်" : mvLive === "starting" ? "စတင်နေ…" : "Go Live"}
            </button>
            {mvLive === "on" && (
              <button
                data-hud="1"
                onClick={cycleCam}
                aria-label="Live ကင်မရာ — မျက်နှာ/အနောက်/ပိတ်"
                title="Live ကင်မရာ PiP — မျက်နှာ → အနောက် → ပိတ်"
                className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] backdrop-blur ${
                  mvCam === "off"
                    ? "border-white/20 bg-black/50 text-white/80"
                    : "border-sky-400/60 bg-sky-500/25 text-sky-200"
                }`}
              >
                {mvCam === "environment" ? "📷 အနောက်" : mvCam === "user" ? "🤳 မျက်နှာ" : "🤳 ကင်မရာ"}
              </button>
            )}
          </div>
        )}
        {ready && (
          <div
            className={`mt-1 flex items-center gap-2 text-white/50 ${
              inGameRoom ? "w-fit rounded bg-black/40 px-1.5 py-0.5 text-[10px]" : ""
            }`}
          >
            <span>{fps} fps</span>
            {clock && !inGameRoom && (
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

        {/* ── ကိုယ်ဘယ်သူလဲ — game room မှာ ဖျောက် (နေရာချွေ) ────────── */}
        {link === "live" && !inGameRoom && (
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
        {/* Game room မှာ ဖျောက် — ညာဘက်တန်း ရှည်ရင် combat ခလုတ်တွေနဲ့
            ထပ်တယ် (ပိုင်ဆိုင်မှုက ပွဲထဲမှာ မလိုအပ်တဲ့ feature)။ */}
        {meAuthed && !inGameRoom && (
          <OwnershipControl wallet={wallet} onChange={setWallet} />
        )}

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
            // ★ Game room မှာ scene ပြန်မဆောက်ဘူး — ပြန်ဆောက်ရင် WS ပြန်ချိတ်
            //   ပြီး "ပွဲထဲက ထွက်ပြီး ပြန်စရသလို" ဖြစ်တယ် (report)။
            //   Avatar ကို နေရာမှာတင် live ပြောင်းတယ်။
            if (inGameRoom) applyAvatarRef.current?.();
            else setAvatarNonce((n) => n + 1);
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

      {/* ── 🤝 NPC context ခလုတ် — မိတ်ဆွေဖွဲ့လို့ရတဲ့ NPC ရဲ့ 5m အတွင်း
          ရောက်မှ ပေါ်တယ် (international context-action pattern — PUBG ရဲ့
          pickup prompt လို)။ ⋯ ထဲက 🤝 chip ကို မသိလည်း ဒီခလုတ်နဲ့
          ဖွဲ့လို့ရတယ်၊ ပေါ်နေရင် အကွာအဝေးက အောင်မြန်တယ်။ */}
      {roomId === "arena" && npcNear && (
        <button
          data-hud="1"
          onClick={waveBefriend}
          className="pointer-events-auto absolute bottom-24 left-1/2 z-10 -translate-x-1/2 animate-pulse rounded-full border-2 border-emerald-400/70 bg-emerald-600/35 px-5 py-2.5 text-sm text-emerald-100 backdrop-blur active:scale-95 active:bg-emerald-500/60"
        >
          🤝 {npcNear} နဲ့ မိတ်ဆွေဖွဲ့မယ်
        </button>
      )}

      {/* ── 🔴 Live / ကင်မရာ error toast — အရင်က error တွေ တိတ်တိတ်ပျောက်လို့
          "Go Live ခလုတ် နှိပ်လို့မရဘူး" ဖြစ်နေတယ်။ ခုက အကြောင်းရင်းကို
          ၆ စက္ကန့် မြင်ရအောင် ပြတယ်။ */}
      {mvErr && (
        <p className="pointer-events-none absolute left-1/2 top-24 z-30 max-w-[86vw] -translate-x-1/2 rounded-lg border border-red-400/40 bg-black/80 px-4 py-2 text-center text-xs text-red-200 backdrop-blur">
          ⚠️ {mvErr}
        </p>
      )}

      {/* ── Chat ───────────────────────────────────────────────────────
          ★ Desktop: ဘယ်အောက် panel (မူလအတိုင်း)။
          ★ Touch (screenshot report: "messenger ကွယ်နေတယ်"): အရင်က
            bottom-20 မှာ joystick နဲ့ ထပ်နေပြီး keyboard ဖွင့်ရင်ပါ
            ကွယ်တယ်။ International mobile-game pattern (PUBG/Free Fire):
            (၁) နောက်ဆုံး ၃ ကြောင်းကို joystick အပေါ်နား ဖောက်ထွင်းပြ
            (ဖတ်ရုံ)၊ (၂) 💬 ခလုတ်နှိပ်မှ input က **မျက်နှာပြင် ထိပ်** မှာ
            ပွင့်တယ် — keyboard က အောက်ကတက်လာလို့ ထိပ်က input ကို
            ဘယ်တော့မှ မဖုံးဘူး။ */}
      {link !== "off" && !touch && (
        <div
          className={`absolute bottom-3 left-3 z-10 w-72 ${
            // Game room မှာ ကျဉ်း — ကျယ်ရင် အလယ်အောက်က ❤️/ကျည် pill နဲ့ ထပ်တယ်
            inGameRoom ? "w-[min(13rem,36vw)]" : ""
          }`}
        >
          <div className="mb-1 max-h-40 space-y-0.5 overflow-hidden">
            {/* Game room မှာ ၄ ကြောင်းပဲ — မြင်ကွင်း အကွယ်နည်းအောင် */}
            {chat.slice(inGameRoom ? -4 : -6).map((c, i) => (
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
      {link !== "off" && touch && (
        <>
          {/* ဖတ်ရုံ chat မှတ်တမ်း — joystick (bottom-6 left-6 h-28) ရဲ့
              အပေါ်နား၊ ဖောက်ထွင်း၊ ထိလို့မရ (game ထိန်းချုပ်မှု မနှောင့်ယှက်) */}
          <div className="pointer-events-none absolute bottom-44 left-3 z-10 w-[min(15rem,55vw)] space-y-0.5">
            {chat.slice(-3).map((c, i) => (
              <div
                key={`${c.at}-${i}`}
                className="w-fit max-w-full rounded bg-black/35 px-1.5 py-0.5 text-[10px] leading-snug text-white/85 backdrop-blur"
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
                {!c.authed && (
                  <span className="ml-1 rounded bg-white/15 px-1 text-[8px] text-white/60">
                    ဧည့်သည်
                  </span>
                )}{" "}
                {c.text}
              </div>
            ))}
          </div>
          {/* 💬 chat ဖွင့်ခလုတ် — joystick အပေါ် တည့်တည့် (လက်မ လှမ်းမီ) */}
          <button
            data-hud="1"
            onClick={() => setChatOpen((o) => !o)}
            aria-label="Chat ရိုက်မယ်"
            className={`absolute bottom-36 left-6 z-10 flex h-9 w-9 items-center justify-center rounded-full border text-[14px] backdrop-blur ${
              chatOpen
                ? "border-emerald-400/60 bg-emerald-500/25"
                : "border-white/20 bg-black/40"
            }`}
          >
            💬
          </button>
          {/* Input — မျက်နှာပြင် ထိပ် (keyboard နဲ့ ဘယ်တော့မှ မထပ်) */}
          {chatOpen && (
            <form
              className="absolute left-1/2 top-14 z-30 flex w-[min(22rem,88vw)] -translate-x-1/2 items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const t = draft.trim();
                if (t) {
                  netRef.current?.sendChat(t);
                  setDraft("");
                }
                setChatOpen(false);
              }}
            >
              <input
                data-hud="1"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={200}
                placeholder="စာရိုက်ရန်…"
                className="min-w-0 flex-1 rounded-full border border-emerald-400/50 bg-black/70 px-4 py-2.5 text-sm text-white outline-none backdrop-blur placeholder:text-white/35"
              />
              <button
                type="submit"
                data-hud="1"
                aria-label="ပို့မယ်"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black"
              >
                ➤
              </button>
              <button
                type="button"
                data-hud="1"
                aria-label="ပိတ်မယ်"
                onClick={() => setChatOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/70"
              >
                ✕
              </button>
            </form>
          )}
        </>
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

/// ⚔️ လက်နက်အလိုက် ချိန်ကွင်း — PUBG-style:
/// ပစ္စတို/ရီဗော်လ်ဗာ = ကွက်လပ်ပါ လက်ဝါးကပ်တိုင် · SMG = ကျယ် ·
/// သေနတ်ကြီး = စက်ဝိုင်း · စနိုက်ပါ = ပါးလွှာ · ဓား/ဗုံး = အစက်။
/// ADS ချိန်နေရင် ကွက်လပ် ကျဉ်းသွားတယ် (ပိုတိကျတဲ့ ခံစားချက်)။
function ArenaCrosshair({ weapon, ads }: { weapon: string; ads: boolean }) {
  if (weapon === "knife" || weapon === "bomb") {
    return (
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 select-none text-lg text-white/85">
        {weapon === "bomb" ? "◎" : "·"}
      </div>
    );
  }
  const gap = ads ? 4 : weapon === "smg" ? 11 : weapon === "shotgun" ? 13 : 7;
  const len = weapon === "sniper" ? 13 : 9;
  const bar: CSSProperties = {
    position: "absolute",
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 0 2px rgba(0,0,0,0.9)",
  };
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {weapon === "shotgun" ? (
        <div
          className="absolute rounded-full border border-white/70"
          style={{ left: -20, top: -20, width: 40, height: 40 }}
        />
      ) : null}
      <div
        style={{
          ...bar,
          left: -1.5,
          top: -1.5,
          width: 3,
          height: 3,
          borderRadius: 99,
        }}
      />
      <div style={{ ...bar, left: -1, top: -(gap + len), width: 2, height: len }} />
      <div style={{ ...bar, left: -1, top: gap, width: 2, height: len }} />
      <div style={{ ...bar, top: -1, left: -(gap + len), height: 2, width: len }} />
      <div style={{ ...bar, top: -1, left: gap, height: 2, width: len }} />
    </div>
  );
}

/// 🔫 လက်နက် icon (SVG silhouette) — စာသားချည်းထက် လက်နက်ပုံ တကယ်မြင်ရမှ
/// ဘယ်ခလုတ်က ဘာလက်နက်လဲ တစ်ချက်ကြည့်တာနဲ့ သိတယ်။ `currentColor` သုံးလို့
/// ရွေးထားချိန် အဝါ၊ မရွေးရသေးရင် မီးခိုး — ခလုတ်အရောင်နဲ့ လိုက်တယ်။
function WeaponIcon({ kind }: { kind: string }) {
  const f = "currentColor";
  return (
    <svg viewBox="0 0 36 16" width={30} height={13} aria-hidden className="block">
      {kind === "knife" ? (
        <>
          <polygon points="9,8 26,4 34,8 26,10.5" fill={f} />
          <rect x="2" y="6.6" width="7.5" height="3" rx="1.2" fill={f} opacity="0.8" />
        </>
      ) : kind === "bomb" ? (
        <>
          <circle cx="17" cy="9.5" r="6" fill={f} />
          <path d="M20 4.5 Q23 1 27 3" stroke={f} strokeWidth="1.5" fill="none" />
          <circle cx="27.4" cy="2.8" r="1.3" fill={f} />
        </>
      ) : kind === "sniper" ? (
        <>
          <rect x="2" y="8" width="32" height="2.4" fill={f} />
          <circle cx="15" cy="5" r="2.6" fill="none" stroke={f} strokeWidth="1.4" />
          <polygon points="2,8 8,8 8,14 3,14" fill={f} />
          <rect x="17" y="10.4" width="3" height="4" fill={f} />
        </>
      ) : kind === "shotgun" ? (
        <>
          <rect x="9" y="7" width="25" height="3" fill={f} />
          <rect x="15" y="10.4" width="8" height="2.6" rx="1.2" fill={f} opacity="0.85" />
          <polygon points="2,6 10,7 10,12.5 2,13.5" fill={f} />
        </>
      ) : kind === "smg" ? (
        <>
          <rect x="6" y="6" width="20" height="4" fill={f} />
          <rect x="26" y="7" width="8" height="2" fill={f} />
          <rect x="13" y="10" width="4" height="6" fill={f} />
          <rect x="6.5" y="10" width="3.5" height="3.5" fill={f} opacity="0.85" />
        </>
      ) : kind === "revolver" ? (
        <>
          <rect x="10" y="5.6" width="24" height="2.8" fill={f} />
          <circle cx="15" cy="8.8" r="3" fill={f} />
          <polygon points="6,8 11.5,8.8 10.5,14.5 5,13.5" fill={f} />
        </>
      ) : (
        <>
          <rect x="8" y="5" width="26" height="4" rx="1" fill={f} />
          <polygon points="8,9 15.5,9 13.8,15 7,14.4" fill={f} />
        </>
      )}
    </svg>
  );
}
