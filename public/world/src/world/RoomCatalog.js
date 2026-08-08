import { CITY_ENTRIES } from './rooms/CityRooms.js';

// ============================================================
// RoomCatalog.js — Metaverse ရဲ့ **အခန်း အားလုံး တစ်နေရာတည်း**
//
// user: "အရင် metaverse rooms အဟောင်းတွေ ရှိတဲ့ Metaverse မပါတော့ဘူး
//        အသေးစိတ် ပြန်ထည့်ပါ"
//
// /metaverse က Open World ဖြစ်သွားတဲ့အခါ Open World ရဲ့ ကိုယ်ပိုင် room
// (ရန်ကုန်, လယ်ကွင်း, မဲဆောက်, Strike) ပဲ ကျန်ပြီး၊ အရင် React scene ရဲ့
// map ၁၀ ခု (မြို့တော်, နှင်းတောင်, ကောင်းကင်ကျွန်း, ဝှက်တမ်း, ပွဲကွင်း,
// Drone တောင်ကြား, Champions, Assassin လမ်းကြား …) က တံခါးမရှိတော့ဘူး။
//
// ဒီစာရင်းက **နှစ်မျိုးလုံးကို တစ်ခုတည်းသော အခန်းစာရင်း** အဖြစ် ပြန်ပေါင်း
// ပေးတယ်：
//   · kind:'world'   — Open World engine ရဲ့ room。 `world.switchTo()` နဲ့
//                      ချက်ချင်း ကူးတယ် (page မပြန်တင်ဘူး၊ ဆက်သွယ်မှု မပြတ်)。
//   · kind:'classic' — အရင် React scene ရဲ့ map。 လောကထဲကပဲ overlay အဖြစ်
//                      ဖွင့်တယ် (Live/Shop/Studio နဲ့ တူညီတဲ့ နည်း) — အပြင်
//                      မထွက်ရဘူး၊ ✕ နှိပ်ရင် လောကထဲ ပြန်ရောက်တယ်။
//
// ★ Blurb/emoji တွေက React map def တွေနဲ့ **တစ်သားတည်း** ဖြစ်ရမယ်
//   (src/components/metaverse/maps/*.ts)。 အဲဒီမှာ ပြင်ရင် ဒီမှာပါ ပြင်ပါ။
// ============================================================

export const ROOM_GROUPS = [
  {
    title: '🌍 လောကထဲက အခန်းများ',
    note: 'ချက်ချင်း ကူးတယ် — page မပြန်တင်ဘူး၊ သူငယ်ချင်းတွေနဲ့ ဆက်တွေ့ရတယ်',
    rooms: [
      { kind: 'world', id: 'yangon', emoji: '🏮', name: 'Cyber-Yangon City',
        blurb: 'ပင်မမြို့တော် — kiosk, ကြော်ငြာနံရံ, radial menu အားလုံး ဒီမှာ' },
      { kind: 'world', id: 'farm', emoji: '🌱', name: 'Gwave Hydro-Lab',
        blurb: 'ရေမြေဆီ စိုက်ခင်း lab — စိမ်းလန်းပြီး ငြိမ်သက်တဲ့ အခန်း' },
      { kind: 'world', id: 'maesot', emoji: '🏘️', name: 'မဲဆောက် နယ်စပ်လမ်း',
        blurb: 'GLB မြို့ပြ မြေပုံ — အဆောက်အဦ အစစ်အမှန် အချိုးအစားနဲ့' },
      { kind: 'world', id: 'mandalay', emoji: '🏯', name: 'မန္တလေးမြို့',
        blurb: '၂.၄ km မြို့ — နန်းတော်+ကျုံး, မန္တလေးတောင်, ဈေးချို, လက်မှုရပ်ကွက်' },
      { kind: 'world', id: 'taxi-district', emoji: '🚕', name: 'တက္ကစီမြို့ (Taxi District)',
        blurb: 'ကွင်းပတ်လမ်း, ၉ ထပ်တိုက် ၁၂ လုံး — ကား ၃ စီး ကိုယ်တိုင် မောင်းလို့ရ' },
      { kind: 'world', id: 'strike', emoji: '⚔️', name: 'GWAVE STRIKE Arena',
        blurb: 'PvP ပစ်ခတ် ပွဲကွင်း — kill/XP က leaderboard ကို တက်တယ်' },
      { kind: 'own', id: 'me', emoji: '🏠', name: 'ကိုယ်ပိုင် Virtual Room',
        blurb: 'ကိုယ့်ကမ္ဘာ — [B] နှိပ်ပြီး တည်ဆောက်၊ link နဲ့ သူငယ်ချင်း ခေါ်' },
    ],
  },
  {
    title: '🏙️ မြန်မာ – ထိုင်း မြို့များ',
    note: 'ချက်ချင်း ကူးတယ် — အဆောက်အအုံတိုင်း တံခါးဝ ပါပြီး ဝင်လို့ရတယ်',
    rooms: CITY_ENTRIES,
  },
  {
    title: '🕹️ Classic အခန်းများ',
    note: 'အရင် Metaverse ရဲ့ map များ — လောကထဲကပဲ ဖွင့်တယ်၊ ✕ နဲ့ ပြန်ဝင်',
    rooms: [
      { kind: 'classic', id: 'city', emoji: '🏙️', name: 'ဂွေ့ဗ် မြို့တော်',
        blurb: 'မီးရောင်စုံ မြို့လယ်၊ တိုက်ရိုက်လွှင့်မှု မျက်နှာပြင်ကြီးနဲ့' },
      { kind: 'classic', id: 'gwave-city', emoji: '🌆', name: 'Gwave City',
        blurb: 'skyline, ဈေးရပ်ကွက်, စက်မှုဇုန်, ရုပ်တုရင်ပြင်နဲ့ မြို့သစ်' },
      { kind: 'classic', id: 'farm', emoji: '🌾', name: 'စိမ်းလန်းချိုင့်ဝှမ်း',
        blurb: 'လယ်ကွင်း၊ ဖန်အိမ်၊ မြစ်တစ်စင်း — စိုက်ခင်း dashboard နဲ့ ချိတ်' },
      { kind: 'classic', id: 'snow', emoji: '❄️', name: 'နှင်းတောင်ထိပ်',
        blurb: 'နှင်းကျနေတဲ့ တောင်ပေါ်ရွာ၊ မီးလုံလောင်ဗူးနဲ့ lodge' },
      { kind: 'classic', id: 'sky', emoji: '☁️', name: 'ကောင်းကင်ကျွန်းများ',
        blurb: 'လေထဲမှာ ပျံနေတဲ့ ကျွန်း ၇ ခု၊ ရေတံခွန်နဲ့ portal အခန်း' },
      { kind: 'classic', id: 'hide-1', emoji: '🙈', name: 'ဝှက်တမ်းဥယျာဉ်',
        blurb: 'ရှာဖွေသူ ၁ ယောက် — ကျန်တာ ပုန်း။ လက်နက်မပါ' },
      { kind: 'classic', id: 'arena', emoji: '🎯', name: 'ပွဲကွင်း (၁၈+)',
        blurb: 'လျှို့ဝှက်ပစ်မှတ်ရှာပြီး ပစ်ခတ် — ဒီ room မှာပဲ လက်နက်ရတယ်' },
      { kind: 'classic', id: 'drone-race', emoji: '🚁', name: 'Drone တောင်ကြား',
        blurb: '🛸 စီးပြီး ကောင်းကင် ring ၇ ခု ဖြတ်ပြိုင်' },
      { kind: 'classic', id: 'champions', emoji: '🏁', name: 'Champions ပြိုင်ကွင်း',
        blurb: 'Checkpoint ပြိုင်ပွဲ — ခြေလျင်၊ ကား၊ drone ကြိုက်တာနဲ့' },
      { kind: 'classic', id: 'assassin-alley', emoji: '🗡️', name: 'Assassin လမ်းကြား',
        blurb: 'ညမြို့လမ်းကြား maze — ပစ်မှတ်ကို လျှို့ဝှက်ချဉ်းကပ်' },
    ],
  },
];

/** အခန်း စုစုပေါင်း (badge မှာ ပြဖို့) */
export const ROOM_COUNT = ROOM_GROUPS.reduce((n, g) => n + g.rooms.length, 0);

/** Classic map ကို လောကထဲက overlay အဖြစ် ဖွင့်မယ့် လမ်းကြောင်း */
export const classicHref = (id) =>
  `/metaverse/classic?room=${encodeURIComponent(id)}&app=1`;
