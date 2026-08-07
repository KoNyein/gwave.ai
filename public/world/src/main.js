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
import { RadialMenu } from './ui/RadialMenu.js';
import { TouchControls } from './ui/TouchControls.js';

// ၁။ အခြေခံစနစ်များ စတင်ခြင်း
const engine  = new Engine(document.body);
const input   = new Input(engine.renderer.domElement);
const physics = new PhysicsWorld();
const hud     = new HUD();
const avatar  = new Avatar(engine, input, physics);
new TouchControls(input); // Mobile ဖြစ်လျှင် joystick/ခလုတ်များ အလိုအလျောက်ပေါ်

// 🧍 ရုပ်တူတစ်ခုတည်း — Social Metaverse (gwave.cc/metaverse) မှာ ရွေးထားတဲ့
// realistic ရုပ်ကိုပဲ ဒီမှာလည်း သုံးတယ်။ Variant က localStorage (mv:soldier —
// same origin မို့ မျှသုံးလို့ရ)၊ မရှိရင် account config ကနေ ဆွဲတယ်။
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

// 📊 Stats API base — leaderboard fetch ရော profile board ရော ဒါကိုသုံး
const statsUrl =
  params.get('api') || params.get('stats') ||
  (isHttps ? `${location.origin}/world-stats` : 'http://localhost:8788');

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
    const station = world.nearestStation();
    const npc = world.nearestNPC();

    if (portal)        hud.showHint(`⏎ E — ${portal.label}`);
    else if (station)  hud.showHint(`⏎ E — ${station.label}`);
    else if (npc)      hud.showHint(`⏎ E — ${npc.name} နှင့် စကားပြောရန်`);
    else               hud.hideHint();

    if (input.justPressed('KeyE')) {
      if (portal) {
        if (portal.targetRoomId === 'myworld') {
          if (net.connected) net.requestWorld(); // server ကနေ ကိုယ့်ကမ္ဘာ load
          else hud.addToast('🌍 ကိုယ်ပိုင်ကမ္ဘာအတွက် server လိုအပ်သည် (offline)');
        } else { world.switchTo(portal.targetRoomId); net.onRoomSwitch(); }
      }
      else if (station) openers[station.action]?.();
      else if (npc) hud.showDialogue(npc.name, npc.nextLine());
    }

    // Hotkeys — I/Q/N/L/M (function openers)
    if (input.justPressed('KeyI')) openers.shop();
    if (input.justPressed('KeyQ')) openers.quests();
    if (input.justPressed('KeyN')) openers.feed();
    if (input.justPressed('KeyL')) openers.board();
    if (input.justPressed('KeyM')) radial.toggle();

    input.endFrame(); // frame အဆုံးမှာ click/keypress ရှင်းရန် (နောက်ဆုံးမှခေါ်ရန်)
  }
});

// ၆။ Cinematic Intro — ရွှေစေတီပတ် ကင်မရာလှည့်ပြီး "စတင်မည်" နှိပ်မှ ထိန်းချုပ်ခွင့်ရ
const introEl = document.querySelector('#intro');
if (introEl) {
  avatar.cameraEnabled = false;
  let introAng = 0;
  const introCam = {
    update(dt) {
      introAng += dt * 0.1;
      const r = 36;
      engine.camera.position.set(Math.sin(introAng) * r, 15, -45 + Math.cos(introAng) * r);
      engine.camera.lookAt(0, 11, -45); // ရွှေစေတီထိပ်ကို ကြည့်
    },
  };
  engine.register(introCam);
  introEl.addEventListener('click', () => {
    introEl.classList.add('fadeOut');
    setTimeout(() => introEl.remove(), 850);
    engine.unregister(introCam);
    avatar.cameraEnabled = true;
  }, { once: true });
}

// ၇။ [N] Feed — FB-style feed ကို metaverse ထဲ holo panel အဖြစ် ရွှေ့ထား
const DEMO_FEED = [
  { who: 'GWAVE Official', when: 'ယခုလေးတင်', text: '🏆 ဒီအပတ် season — ထိပ်ဆုံး ၃ ယောက်ကို GP 500/300/150 ဆုချမည်။ [L] နှိပ်ပြီး အဆင့်ကြည့်ပါ!' },
  { who: 'KoNyein', when: '၂ နာရီအကြာ', text: '🌍 ကျွန်တော့်ကမ္ဘာအသစ်မှာ ဈေးဆိုင်စင်တွေ ထည့်ပြီးပြီ — လာလည်ကြပါဦး!' },
  { who: 'GWAVE Rooftop', when: 'ဒီနေ့', text: '☕ GP 500 = ကော်ဖီ ၁ ခွက် အခမဲ့ — [I] ထဲက 🎁 မှာ code လဲပြီး ဆိုင်မှာပြပါ။' },
];
// gwave.cc ရဲ့ feed အစစ် — same-origin မို့ login cookie ပါပြီးသား။
// Guest (401) ဒါမှမဟုတ် ဆွဲမရရင် DEMO_FEED နဲ့ ဆက်ပြတယ်။
const feedUrl = params.get('feed') || '/api/posts?scope=feed';
const timeAgoMy = (iso) => {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ယခုလေးတင်';
  if (m < 60) return `${Math.floor(m)} မိနစ်အကြာ`;
  if (m < 1440) return `${Math.floor(m / 60)} နာရီအကြာ`;
  return `${Math.floor(m / 1440)} ရက်အကြာ`;
};
async function loadFeed() {
  try {
    const res = await fetch(feedUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('feed');
    const d = await res.json();
    const rows = d.posts || d.items || d;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty');
    hud.setFeedPanel(rows.slice(0, 12).map(p => ({
      who: p.who || p.author?.full_name || p.author?.username || 'Gwave',
      when: p.when || (p.created_at ? timeAgoMy(p.created_at) : ''),
      text: p.text || p.content || '',
    })));
  } catch { hud.setFeedPanel(DEMO_FEED); }
}

// ၈။ 🧭 Function Openers — key/station/radial menu သုံးမျိုးလုံးက ဒီကိုခေါ်
const closeAll = () => ['#lbPanel','#walletPanel','#questPanel','#feedPanel','#avatarPanel','#projectsPanel']
  .forEach(sel => document.querySelector(sel).style.display = 'none');
function openPanel(sel, onOpen) {
  const wasOpen = document.querySelector(sel).style.display === 'block';
  closeAll();
  if (!wasOpen) { document.querySelector(sel).style.display = 'block'; onOpen?.(); }
}
const openers = {
  board:   () => openPanel('#lbPanel', () => fetchLeaderboard(currentSeason)),
  shop:    () => openPanel('#walletPanel', () => {
             if (net.connected) { net.requestWallet(); net.requestRewards(); net.requestTrophies(); }
             else hud.setWalletPanel(null);
           }),
  pos:     () => openers.shop(), // POS = shop panel ရဲ့ 🎁 အပိုင်း
  quests:  () => openPanel('#questPanel', () => net.connected ? net.requestQuests() : hud.setQuestsPanel(null)),
  feed:    () => openPanel('#feedPanel', loadFeed),
  avatar:  () => openPanel('#avatarPanel'),
  projects:() => openPanel('#projectsPanel'),
  world:   () => { if (net.connected) net.requestWorld(); else hud.addToast('🌍 server လိုအပ်သည် (offline)'); },
  arena:   () => { world.switchTo('strike'); net.onRoomSwitch(); },
};

// ☰ Radial Menu — mobile-first metaverse menu (M key လည်းရ)
const radial = new RadialMenu([
  { icon: '🧬', label: 'Avatar',  action: openers.avatar },
  { icon: '🛍️', label: 'Shop',    action: openers.shop },
  { icon: '🎯', label: 'Quest',   action: openers.quests },
  { icon: '📰', label: 'Feed',    action: openers.feed },
  { icon: '🏆', label: 'Board',   action: openers.board },
  { icon: '🌍', label: 'ကမ္ဘာ',    action: openers.world },
  { icon: '⚔️', label: 'Arena',   action: openers.arena },
], hud);

// 🧬 Avatar Studio — preset ၆ မျိုး + 3D scan GLB ချိတ်ခြင်း (localStorage သိမ်း)
const AVATAR_PRESETS = [
  { id: 'jade',  nm: 'စိမ်းလဲ့',   body: '#3ddc97', head: '#ffd9a0' },
  { id: 'gold',  nm: 'ရွှေ',      body: '#f5c542', head: '#ffd9a0' },
  { id: 'ruby',  nm: 'ပတ္တမြား',  body: '#d8324a', head: '#ffd9a0' },
  { id: 'cyber', nm: 'Cyber',    body: '#7f5cff', head: '#e8d5ff' },
  { id: 'sky',   nm: 'မိုးပြာ',    body: '#2d9bf0', head: '#ffd9a0' },
  { id: 'night', nm: 'ညမှောင်',   body: '#2a2f3a', head: '#c9b48a' },
];
const avGrid = document.querySelector('#avGrid');
const savedPreset = localStorage.getItem('gwave_avatar_preset');
AVATAR_PRESETS.forEach(pr => {
  const el = document.createElement('div');
  el.className = 'avCard' + (pr.id === savedPreset ? ' active' : '');
  el.innerHTML = `<div class="cap" style="background:${pr.body};--hd:${pr.head}"></div><div class="nm">${pr.nm}</div>`;
  el.addEventListener('click', () => {
    avatar.applyPreset(pr);
    localStorage.setItem('gwave_avatar_preset', pr.id);
    document.querySelectorAll('.avCard').forEach(c => c.classList.toggle('active', c === el));
    hud.addToast(`🧬 Avatar — ${pr.nm} preset`);
  });
  avGrid.appendChild(el);
});
const saved = AVATAR_PRESETS.find(pr => pr.id === savedPreset);
if (saved) avatar.applyPreset(saved);
document.querySelector('#avScanFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  avatar.setModel(URL.createObjectURL(f));
  hud.addToast('📷 3D scan avatar ချိတ်နေသည်…');
});

// 📁 Projects panel content
document.querySelector('#projectsContent').innerHTML = [
  { t: '🌊 gwave.cc', d: 'Social + metaverse platform — ယခု သင်ရောက်နေသောနေရာ' },
  { t: '⚔️ GWAVE STRIKE', d: 'PvP FPS arena — server-authoritative, seasons, NFT skins' },
  { t: '🚁 Drone Simulator', d: 'FPV/kamikaze drone physics simulator + garage' },
  { t: '🌱 Hydro-Lab', d: 'Smart farm နည်းပညာ — hydroponics + sensors' },
  { t: '🧬 3D Scanner', d: 'လူကို GLB avatar အဖြစ် scan — Avatar Studio မှာချိတ်နိုင်' },
].map(pj => `<div class="feedCard"><span class="who">${pj.t}</span><div class="txt">${pj.d}</div></div>`).join('');

// Open Wall (in-world feed) — feed data ရလျှင် Yangon နံရံပေါ်ပါ တင်
const _setFeed = hud.setFeedPanel.bind(hud);
hud.setFeedPanel = (posts) => {
  _setFeed(posts);
  world.rooms.get('yangon')?.setFeedWallPosts?.(posts);
};
setTimeout(loadFeed, 1500); // စဝင်ချိန် wall ကို feed ဖြည့်

ctx.statsUrl = statsUrl; // Profile room stats board အတွက်

// 🌐 Social Metaverse ဂိတ် — Open World နဲ့ gwave.cc/metaverse က
// **တစ်ခုတည်းသော လောက**။ ?embed=1 (metaverse overlay ထဲက ဖွင့်တာ) ဆိုရင်
// overlay ကို ပိတ်ခိုင်း၊ မဟုတ်ရင် /metaverse ကို တိုက်ရိုက် သွားတယ်။
{
  const embedded = params.get('embed') === '1';
  const gate = document.createElement('button');
  gate.textContent = embedded ? '🌐 လောကထဲ ပြန်' : '🌐 Social Metaverse';
  gate.title = 'gwave.cc Social Metaverse';
  gate.style.cssText =
    'position:fixed;left:14px;bottom:64px;z-index:7;font-family:inherit;font-size:13px;' +
    'padding:9px 14px;border-radius:10px;cursor:pointer;color:var(--ink);' +
    'background:linear-gradient(165deg,var(--panel),rgba(11,16,38,.86));' +
    'border:1px solid var(--line);backdrop-filter:blur(10px)';
  gate.onclick = () => {
    document.exitPointerLock?.();
    if (embedded && window.parent !== window) {
      window.parent.postMessage({ type: 'gwave:exit-world' }, location.origin);
    } else {
      location.href = '/metaverse';
    }
  };
  document.body.appendChild(gate);
}

// ၉။ စတင်!
hud.hideLoading();
engine.start();
console.log('🌊 Gwave Metaverse — Yangon City OS (v10) ready');
