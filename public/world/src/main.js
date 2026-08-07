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

// GLB avatar ရှိလျှင် ဤနေရာမှာ ချိတ်ပါ (gwave 3D scanner ထွက် ဖိုင်)
// avatar.setModel('./assets/my_avatar.glb');

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

// Stats API — Kill/XP leaderboard ([L] ဖြင့်ဖွင့်/ပိတ်) ။ ?api=https://... ဖြင့်ပြောင်းနိုင်
const stats = new StatsAPI(
  params.get('api') ||
    (isHttps ? `${location.origin}/world-stats` : 'http://localhost:8788'),
);

// ၄။ Web3 Wallet
const wallet = new Wallet();
hud.walletBtn.addEventListener('click', async () => {
  const result = await wallet.connect();
  if (result.error) { alert(result.error); return; }
  hud.setWallet(result.address, wallet.short());
});
wallet.onChange = () => hud.setWallet(wallet.address, wallet.short());

// ၅။ Interaction Loop — portal hint + NPC စကားပြော (E key)
engine.register({
  update() {
    const portal = world.nearestPortal();
    const npc = world.nearestNPC();

    if (portal)   hud.showHint(`⏎ E — ${portal.label}`);
    else if (npc) hud.showHint(`⏎ E — ${npc.name} နှင့် စကားပြောရန်`);
    else          hud.hideHint();

    if (input.justPressed('KeyE')) {
      if (portal) { world.switchTo(portal.targetRoomId); net.onRoomSwitch(); }
      else if (npc) hud.showDialogue(npc.name, npc.nextLine());
    }

    // [L] — Leaderboard ဖွင့်/ပိတ် (RDS game.* မှ ဖတ်)
    if (input.justPressed('KeyL')) {
      if (hud.leaderboardVisible()) hud.hideLeaderboard();
      else stats.leaderboard(10)
        .then((rows) => hud.showLeaderboard(rows, playerName))
        .catch(() => hud.addToast('📊 Stats API မချိတ်နိုင်ပါ (?api=... စစ်ပါ)'));
    }
    input.endFrame(); // frame အဆုံးမှာ click/keypress ရှင်းရန် (နောက်ဆုံးမှခေါ်ရန်)
  }
});

// ၆။ စတင်!
hud.hideLoading();
engine.start();
console.log('🌊 Gwave Metaverse Base Framework v5 — PvP + Cognito + RDS Kill/XP stats + [L] leaderboard ready');
