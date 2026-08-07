// ============================================================
// main.js — အားလုံးကို ချိတ်ဆက်သည့် အဓိကဖိုင် (Entry Point)
// Engine + Input + Physics + Avatar + World (Rooms ၄ ခု) + Web3 + HUD
// ============================================================
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { PhysicsWorld } from './core/Physics.js';
import { Avatar } from './entities/Avatar.js';
import { WorldManager } from './world/WorldManager.js';
import { YangonRoom } from './world/rooms/YangonRoom.js';
import { FarmRoom } from './world/rooms/FarmRoom.js';
import { MaeSotRoom } from './world/rooms/MaeSotRoom.js';
import { StrikeRoom } from './world/rooms/StrikeRoom.js';
import { UserWorldRoom } from './world/rooms/UserWorldRoom.js';
import { Wallet } from './web3/Wallet.js';
import { HUD } from './ui/HUD.js';
import { NetClient } from './net/NetClient.js';
import { getGwaveToken, getTokenName } from './web3/GwaveAuth.js';
import { StatsAPI } from './net/StatsAPI.js';
import { TouchControls } from './ui/TouchControls.js';

// ၁။ အခြေခံစနစ်များ စတင်ခြင်း
const engine  = new Engine(document.body);
const input   = new Input(engine.renderer.domElement);
const physics = new PhysicsWorld();
const hud     = new HUD();
const avatar  = new Avatar(engine, input, physics);
new TouchControls(input); // Mobile ဖြစ်လျှင် joystick/ခလုတ်များ အလိုအလျောက်ပေါ်

// 🧍 ရုပ်တူတစ်ခုတည်း — Social Metaverse (gwave.cc/metaverse) မှာ ရွေးထားတဲ့
// realistic ရုပ်ကိုပဲ ဒီမှာလည်း သုံးတယ် (user: "လောက ၂ ခုကို ပေါင်းစည်း")။
// Variant က localStorage (mv:soldier — same origin မို့ မျှသုံးလို့ရ)၊
// မရှိရင် account config ကနေ ဆွဲတယ်။ ဆွဲမရရင် placeholder နဲ့ ဆက်သွား။
const REALISTIC_FILES = {
  a: 'Remy', b: 'Soldier', c: 'Soldier', d: 'Michelle', e: 'Character3',
  f: 'Character4', g: 'Xbot', h: 'Michelle2', i: 'Clown', j: 'Soldier',
  k: 'Granny', l: 'Xbot', m: 'Soldier', n: 'Michelle', o: 'Character5',
  p: 'Character3', q: 'Character4', r: 'Character5',
};
const applyVariant = (v) => {
  const file = REALISTIC_FILES[v];
  if (file) void avatar.setModel(`/metaverse/realistic/${file}.glb`);
};
{
  let v = null;
  try { v = localStorage.getItem('mv:soldier'); } catch { /* private mode */ }
  if (v && REALISTIC_FILES[v]) applyVariant(v);
  else {
    fetch('/api/metaverse/avatar', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.config?.variant) applyVariant(d.config.variant); })
      .catch(() => undefined);
  }
}

// ၂။ World + Rooms — room အသစ်တိုးလိုလျှင် import + register ၂ ကြောင်းသာ
const ctx = { engine, input, avatar, hud };
const world = new WorldManager(ctx);
world.register(new YangonRoom());
world.register(new FarmRoom());
world.register(new MaeSotRoom());   // GLB city map pipeline နမူနာ
world.register(new StrikeRoom(ctx)); // GWAVE STRIKE FPS arena
world.switchTo('yangon'); // ပထမဆုံး ဝင်မည့် room

// ၃။ Multiplayer — ?server=wss://...&name=... ဖြင့် ချိန်ညှိနိုင်
// gwave.cc တရားဝင် login — Cognito token ကို အလိုအလျောက် ရှာပြီး server ဆီပို့
// Server မ run ထားလျှင်လည်း offline ဖြင့် ပုံမှန်ကစားနိုင်သည်
const params = new URLSearchParams(location.search);
const token = getGwaveToken();
const playerName =
  params.get('name') ||
  (token && getTokenName(token)) ||
  'Player-' + Math.floor(Math.random() * 1000);
const net = new NetClient({ engine, world, avatar, hud });
ctx.net = net; // StrikeRoom PvP အတွက် room များထံ ဆက်ပေး
// gwave.cc မှာ တင်ထားလျှင် same-origin Caddy proxy (/world-ws, /world-stats)
// ကို default သုံး — local dev မှာသာ localhost port များ
const isHttps = location.protocol === 'https:';
const serverUrl =
  params.get('server') ||
  (isHttps ? `wss://${location.host}/world-ws` : 'ws://localhost:8787');
net.connect(serverUrl, { name: playerName, token });

// 📊 Stats API — URL တစ်ခုတည်း (seasons fetch ရော StatsAPI helper ရော) —
// ?api=https://... ဖြင့် ပြောင်းနိုင်
const statsUrl =
  params.get('api') || params.get('stats') ||
  (isHttps ? `${location.origin}/world-stats` : 'http://localhost:8788');
const stats = new StatsAPI(statsUrl);

// 🏆 Leaderboard seasons
let currentSeason = 'alltime';
function fetchLeaderboard(season) {
  fetch(`${statsUrl}/leaderboard?limit=10&season=${season}`)
    .then(r => r.json())
    .then(d => hud.setLeaderboard(d.leaderboard))
    .catch(() => hud.setLeaderboard(null, '📊 Stats API မချိတ်နိုင်ပါ (api/ ကို run ထားပါ)'));
}
document.querySelectorAll('#lbTabs .lbTab').forEach(btn =>
  btn.addEventListener('click', () => {
    currentSeason = btn.dataset.season;
    document.querySelectorAll('#lbTabs .lbTab').forEach(b => b.classList.toggle('lbActive', b === btn));
    fetchLeaderboard(currentSeason);
  }));

// 🌍 ကိုယ်ပိုင်ကမ္ဘာ — server က world data ပြန်ပို့လျှင် room ဆောက်ပြီး ကူး
net.onWorld = ({ key, name, data, own }) => {
  const roomId = `world:${key}`;
  const room = new UserWorldRoom(ctx, { key, name, data, own });
  world.rooms.delete(roomId); // update ဖြစ်လျှင် အသစ်ပြန်ဆောက်
  world.register(room);
  world.switchTo(roomId);
  net.onRoomSwitch();
  if (own) hud.addToast('🌍 ကိုယ်ပိုင်ကမ္ဘာ — [B] နှိပ်ပြီး တည်ဆောက်ပါ');
};
// ?world=<key> ဖြင့် သူများကမ္ဘာ တိုက်ရိုက်လည်ပတ်နိုင်
const visitWorld = params.get('world');
if (visitWorld) {
  const tryVisit = setInterval(() => {
    if (net.connected) { clearInterval(tryVisit); net.requestWorld(visitWorld); }
  }, 500);
}

// ၄။ Web3 Wallet
const wallet = new Wallet();
hud.walletBtn.addEventListener('click', async () => {
  const result = await wallet.connect();
  if (result.error) { alert(result.error); return; }
  hud.setWallet(result.address, wallet.short());
});
wallet.onChange = () => hud.setWallet(wallet.address, wallet.short());
net.web3Address = () => wallet.address; // NFT mint အတွက် MetaMask address

// ၅။ Interaction Loop — portal hint + NPC စကားပြော (E key)
engine.register({
  update() {
    const portal = world.nearestPortal();
    const npc = world.nearestNPC();

    if (portal)   hud.showHint(`⏎ E — ${portal.label}`);
    else if (npc) hud.showHint(`⏎ E — ${npc.name} နှင့် စကားပြောရန်`);
    else          hud.hideHint();

    if (input.justPressed('KeyE')) {
      if (portal) {
        if (portal.targetRoomId === 'myworld') {
          if (net.connected) net.requestWorld(); // server ကနေ ကိုယ့်ကမ္ဘာ load
          else hud.addToast('🌍 ကိုယ်ပိုင်ကမ္ဘာအတွက် server လိုအပ်သည် (offline)');
        } else { world.switchTo(portal.targetRoomId); net.onRoomSwitch(); }
      }
      else if (npc) hud.showDialogue(npc.name, npc.nextLine());
    }

    // [I] — Shop + ပိုက်ဆံအိတ် | [Q] — Daily Quests (Phase 0 economy)
    if (input.justPressed('KeyI')) {
      if (hud.togglePanel('#walletPanel')) {
        if (net.connected) { net.requestWallet(); net.requestRewards(); net.requestTrophies(); }
        else hud.setWalletPanel(null);
      }
    }
    if (input.justPressed('KeyQ')) {
      if (hud.togglePanel('#questPanel')) {
        if (net.connected) net.requestQuests();
        else hud.setQuestsPanel(null);
      }
    }

    // [L] — Leaderboard (alltime/weekly/monthly seasons)
    if (input.justPressed('KeyL')) {
      if (hud.toggleLeaderboard()) fetchLeaderboard(currentSeason);
    }
    input.endFrame(); // frame အဆုံးမှာ click/keypress ရှင်းရန် (နောက်ဆုံးမှခေါ်ရန်)
  }
});

// 🌐 Social Metaverse ဂိတ် — Open World နဲ့ gwave.cc/metaverse က
// **တစ်ခုတည်းသော လောက** (user: "/metaverse နဲ့ /world ကို ပေါင်းစည်း")။
// ?embed=1 (metaverse overlay ထဲက ဖွင့်တာ) ဆိုရင် overlay ကို ပိတ်ခိုင်း၊
// မဟုတ်ရင် /metaverse ကို တိုက်ရိုက် သွားတယ်။
{
  const embedded = params.get('embed') === '1';
  const gate = document.createElement('button');
  gate.textContent = embedded ? '🌐 လောကထဲ ပြန်' : '🌐 Social Metaverse';
  gate.title = 'gwave.cc Social Metaverse';
  gate.style.cssText =
    'position:fixed;left:14px;bottom:64px;z-index:7;font-family:inherit;font-size:13px;' +
    'padding:9px 14px;border-radius:10px;cursor:pointer;color:#eaf0ff;' +
    'background:rgba(10,16,34,.85);border:1px solid #1d2a4d;backdrop-filter:blur(6px)';
  gate.onclick = () => {
    document.exitPointerLock?.();
    if (embedded && window.parent !== window) {
      // Metaverse overlay က ဒီ message ကို နားထောင်ပြီး iframe ပိတ်တယ်
      window.parent.postMessage({ type: 'gwave:exit-world' }, location.origin);
    } else {
      location.href = '/metaverse';
    }
  };
  document.body.appendChild(gate);
}

// ၆။ စတင်!
hud.hideLoading();
engine.start();
console.log('🌊 Gwave Metaverse Base Framework v5 — PvP + Cognito + RDS Kill/XP stats + [L] leaderboard ready');
