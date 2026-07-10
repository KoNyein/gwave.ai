// Scratch-style block coding track for /learn. Burmese-primary content plus an
// interactive block playground (see components/learn/scratch-playground.tsx).
// Pure data — safe to import from server components.

import type { Track } from "@/lib/learn/lessons";

export const scratchTrack: Track = {
  slug: "scratch",
  title: "Scratch: Block Coding",
  description:
    "Block တွေ ဆက်တပ်ရုံနဲ့ ကိုယ်ပိုင် ကာတွန်း၊ ပုံဆွဲ၊ ဂိမ်း တွေ တည်ဆောက်ပါ — code စာမရိုက်ဘဲ တွေးခေါ်နည်း သင်ယူမယ်။",
  icon: "Blocks",
  bands: ["child", "preteen", "teen", "adult"],
  lessons: [
    // 1 ── What is block coding
    {
      slug: "what-is-scratch",
      title: "Scratch ဆိုတာ ဘာလဲ",
      summary: "Block coding ဆိုတာ ဘာလဲ၊ ဘာကြောင့် စတင်လေ့လာသင့်လဲ။",
      minutes: 6,
      kind: "reading",
      sections: [
        {
          heading: "Block coding ဆိုတာ",
          body: "Scratch ကတော့ ကမ္ဘာကျော် block-coding ပလက်ဖောင်းတစ်ခုပါ။ code စာလုံးတွေ မရိုက်ဘဲ 'block' လေးတွေ (ပဟေဠိ အစိတ်အပိုင်းလို) ဆက်တပ်ရုံနဲ့ ကွန်ပျူတာကို အမိန့်ပေးနိုင်ပါတယ်။ ကလေးတွေ ကုဒ်ရေးနည်း စတင်လေ့လာဖို့ အကောင်းဆုံး နည်းလမ်းပါ။",
        },
        {
          heading: "ဘာလို့ block တွေ သုံးတာလဲ",
          body: "Block တွေက အမှားနည်းပါတယ် — ကိုက်ညီတဲ့ block တွေပဲ ဆက်လို့ရလို့ syntax error မဖြစ်ပါ။ ဒါကြောင့် 'ဘာလုပ်ချင်လဲ' ဆိုတဲ့ တွေးခေါ်နည်း (logic) ကိုပဲ အာရုံစိုက်နိုင်ပါတယ်။ နောက်ပိုင်း Python, JavaScript စတဲ့ စာသားကုဒ်တွေ ကူးပြောင်းရလွယ်ပါတယ်။",
        },
        {
          heading: "Sprite နဲ့ Stage",
          body: "Sprite ဆိုတာ ဇာတ်ခုံ (Stage) ပေါ်မှာ ကပြတဲ့ ဇာတ်ကောင် (ဥပမာ 🐱 ကြောင်လေး) ပါ။ ကျွန်တော်တို့ block တွေနဲ့ sprite ကို ရွှေ့ဖို့၊ လှည့်ဖို့၊ ပြောဖို့၊ ပုံဆွဲဖို့ အမိန့်ပေးမှာပါ။ နောက် သင်ခန်းစာတွေမှာ ကိုယ်တိုင် စမ်းကြည့်ရမယ်။",
        },
      ],
    },
    // 2 ── First move
    {
      slug: "first-move",
      title: "ပထမဆုံး ရွှေ့ကြည့်ရအောင်",
      summary: "«ရှေ့သွား» block နဲ့ ကြောင်လေးကို ရွှေ့ကြည့်မယ်။",
      minutes: 8,
      kind: "scratch",
      sections: [
        {
          heading: "လုပ်ဆောင်ရန်",
          body: "ဘယ်ဘက်က 'အလှုပ်ရှား (Motion)' အုပ်စုထဲက «ခြေလှမ်း ရှေ့သွား» block ကို နှိပ်ပြီး script ထဲ ထည့်ပါ။ ပြီးရင် 'Run' နှိပ်ကြည့်ပါ — ကြောင်လေး ညာဘက်ကို ရွေ့သွားပါလိမ့်မယ်။ ဂဏန်းကို ပြောင်းပြီး ဘယ်လောက် ရွှေ့လဲ စမ်းကြည့်ပါ။",
        },
        {
          heading: "ရည်မှန်းချက်",
          body: "🎯 ပစ်မှတ်ဆီ ရောက်အောင် «ရှေ့သွား» block တွေ ထပ်ထည့်ပါ။ ခြေလှမ်း အရေအတွက်ကို ချိန်ကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [{ kind: "move", arg: 40 }],
        goal: { reach: { x: 120, y: 0 }, requireKinds: ["move"] },
      },
    },
    // 3 ── Turning
    {
      slug: "turning",
      title: "လှည့်ခြင်း နဲ့ ထောင့်",
      summary: "«လှည့်» block နဲ့ ဦးတည်ရာ ပြောင်းကြည့်မယ်။",
      minutes: 8,
      kind: "scratch",
      sections: [
        {
          heading: "ထောင့် (Degrees)",
          body: "«ညာဘက် ၉၀° လှည့်» ဆိုတာ ကြောင်လေးကို ညာဘက် စတုတ္ထ တစ်ပတ် (quarter turn) လှည့်တာပါ။ ၉၀° လေးကြိမ် လှည့်ရင် တစ်ပတ် (၃၆၀°) ပြည့်ပါတယ်။",
        },
        {
          heading: "စမ်းကြည့်ပါ",
          body: "«ရှေ့သွား» ပြီး «ညာဘက် ၉၀° လှည့်» ပြီး ထပ် «ရှေ့သွား» — ကြောင်လေး ထောင့်ချိုးသွားတာ တွေ့ရပါမယ်။ 🎯 ပစ်မှတ်ဆီ ရောက်အောင် လမ်းကြောင်း တစ်ခု တည်ဆောက်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "move", arg: 80 },
          { kind: "turnRight", arg: 90 },
          { kind: "move", arg: 80 },
        ],
        goal: { reach: { x: 80, y: -80 }, requireKinds: ["move", "turnRight"] },
      },
    },
    // 4 ── Loops (reading)
    {
      slug: "loops-intro",
      title: "Loop — ထပ်ခါလုပ်ခြင်း",
      summary: "«ထပ်လုပ်» block နဲ့ တူညီတဲ့ အလုပ်ကို အကြိမ်ကြိမ် ခိုင်းမယ်။",
      minutes: 7,
      kind: "reading",
      sections: [
        {
          heading: "ဘာကြောင့် loop လိုလဲ",
          body: "«ရှေ့သွား၊ လှည့်၊ ရှေ့သွား၊ လှည့်…» အကြိမ်ကြိမ် ရေးရမယ်ဆိုရင် ပင်ပန်းပါတယ်။ 'Loop' က တူညီတဲ့ block အစုကို 'ဘယ်နှစ်ကြိမ် ထပ်လုပ်' လို့ တစ်ခါတည်း ခိုင်းလို့ရပါတယ်။",
        },
        {
          heading: "Repeat block",
          body: "«၄ ကြိမ် ထပ်လုပ်» block ကြားထဲ ထည့်ထားတဲ့ block တွေ ၄ ကြိမ် အလုပ်လုပ်ပါတယ်။ 'ထပ်လုပ်' ပြီးရင် «ထပ်လုပ် ဆုံး» block နဲ့ ပိတ်ပါ။ ကြားက block တွေဟာ အတွင်းသို့ တစ်ဆင့် ရွှေ့ပြထားပါလိမ့်မယ်။",
        },
        {
          heading: "ဥပမာ",
          body: "စတုဂံ (လေးထောင့်) တစ်ခု ဆွဲချင်ရင် — «၄ ကြိမ် ထပ်လုပ် [ ရှေ့သွား ၊ ညာဘက် ၉၀° လှည့် ]» လို့ ရေးရုံပါပဲ။ နောက်သင်ခန်းစာမှာ ကိုယ်တိုင် ဆွဲကြည့်မယ်။",
          code: "၄ ကြိမ် ထပ်လုပ်\n    ၈၀ ခြေလှမ်း ရှေ့သွား\n    ညာဘက် ၉၀° လှည့်\nထပ်လုပ် ဆုံး",
        },
      ],
      quiz: [
        {
          q: "«၄ ကြိမ် ထပ်လုပ် [ ရှေ့သွား ]» ဆိုရင် ကြောင်လေး ဘယ်နှစ်ကြိမ် ရှေ့သွားမလဲ။",
          options: ["၁ ကြိမ်", "၄ ကြိမ်", "၀ ကြိမ်", "အဆုံးမရှိ"],
          answer: 1,
          explain: "Repeat 4 က အတွင်းက block ကို ၄ ကြိမ် ထပ်လုပ်ပါတယ်။",
        },
        {
          q: "စတုဂံ ဆွဲဖို့ ဘယ်နှစ်ထောင့် လှည့်ရမလဲ။",
          options: ["၄၅°", "၆၀°", "၉၀°", "၁၈၀°"],
          answer: 2,
          explain: "လေးထောင့်မို့ ၉၀° လေးကြိမ် လှည့်ရပါတယ်။",
        },
      ],
    },
    // 5 ── Draw a square with pen
    {
      slug: "draw-square",
      title: "စတုဂံ ဆွဲကြမယ်",
      summary: "ခဲတံ ချ + loop နဲ့ လေးထောင့် တစ်ခု ဆွဲမယ်။",
      minutes: 10,
      kind: "scratch",
      sections: [
        {
          heading: "ခဲတံ (Pen)",
          body: "«ခဲတံ ချ» block ထည့်ရင် ကြောင်လေး ရွှေ့သွားတဲ့ လမ်းကြောင်းအတိုင်း မျဉ်း ဆွဲသွားပါတယ်။ «ခဲတံ မ» ဆိုရင် မဆွဲတော့ပါ။",
        },
        {
          heading: "ရည်မှန်းချက်",
          body: "«ခဲတံ ချ» ပြီး «၄ ကြိမ် ထပ်လုပ် [ ရှေ့သွား ၊ ညာဘက် ၉၀° လှည့် ]» သုံးပြီး စတုဂံ တစ်ခု ဆွဲပါ။ ✅ Run နှိပ်ပြီး ပုံ ပေါ်လာအောင် လုပ်ကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "penDown" },
          { kind: "repeat", arg: 4 },
          { kind: "move", arg: 80 },
          { kind: "turnRight", arg: 90 },
          { kind: "repeatEnd" },
        ],
        goal: { requireKinds: ["penDown", "move", "turnRight"] },
      },
    },
    // 6 ── Say (Looks)
    {
      slug: "say-hello",
      title: "ပြောခြင်း (Looks)",
      summary: "«ပြော» block နဲ့ ကြောင်လေးကို စကားပြောစေမယ်။",
      minutes: 6,
      kind: "scratch",
      sections: [
        {
          heading: "စကားပြောခြင်း",
          body: "'ပုံပန်း (Looks)' အုပ်စုထဲက «ပြော» block က ကြောင်လေးရဲ့ ဘေးမှာ စကားပြော ပူဖောင်းလေး ပြပါတယ်။ စာသားကို ကိုယ်ကြိုက်တာ ပြောင်းရေးလို့ရပါတယ် — မြန်မာလိုလည်း ရပါတယ်။",
        },
        {
          heading: "ရည်မှန်းချက်",
          body: "ကြောင်လေးကို «မင်္ဂလာပါ» ပြောစေပြီး၊ ရှေ့သွား၊ နောက်ထပ် တစ်ခုခု ပြောစေပါ။ ကိုယ်ပိုင် စကားဝိုင်း တစ်ခု ဖန်တီးကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "say", arg: "မင်္ဂလာပါ" },
          { kind: "move", arg: 40 },
        ],
        goal: { requireKinds: ["say"] },
      },
    },
    // 7 ── Pen art (triangle)
    {
      slug: "pen-art",
      title: "ခဲတံနဲ့ ပုံဆွဲခြင်း",
      summary: "အရောင်ပြောင်း + loop နဲ့ တြိဂံ / ကြယ် ဆွဲမယ်။",
      minutes: 10,
      kind: "scratch",
      sections: [
        {
          heading: "တြိဂံ",
          body: "တြိဂံ (သုံးထောင့်) ဆွဲဖို့ «၃ ကြိမ် ထပ်လုပ် [ ရှေ့သွား ၊ ညာဘက် ၁၂၀° လှည့် ]» သုံးပါ။ (၃၆၀° ÷ ၃ = ၁၂၀°)",
        },
        {
          heading: "အရောင်",
          body: "«ခဲတံ အရောင် ပြောင်း» block နဲ့ မျဉ်းအရောင် ပြောင်းလို့ရပါတယ်။ ထောင့်ကို ၁၄၄° ထားပြီး ၅ ကြိမ် ထပ်လုပ်ရင် ⭐ ကြယ်ပုံ ရပါတယ် — စမ်းကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "penDown" },
          { kind: "repeat", arg: 3 },
          { kind: "move", arg: 90 },
          { kind: "turnRight", arg: 120 },
          { kind: "repeatEnd" },
        ],
        goal: { requireKinds: ["penDown", "repeat", "move", "turnRight"] },
      },
    },
    // 8 ── Events (reading)
    {
      slug: "events",
      title: "Events — ဘယ်အချိန် စလဲ",
      summary: "«အစိမ်းရောင် အလံ နှိပ်တဲ့အခါ» လို event block တွေ။",
      minutes: 6,
      kind: "reading",
      sections: [
        {
          heading: "Event ဆိုတာ",
          body: "Scratch မှာ program က 'ဘယ်အချိန် စ' လဲဆိုတာ Event block တွေက ဆုံးဖြတ်ပါတယ်။ ဥပမာ «အစိမ်းရောင် အလံ နှိပ်တဲ့အခါ»၊ «space key နှိပ်တဲ့အခါ»၊ «sprite ကို click လုပ်တဲ့အခါ» စသဖြင့်ပါ။",
        },
        {
          heading: "ဘာကြောင့် အရေးကြီးလဲ",
          body: "Event တွေက အသုံးပြုသူ (player) နဲ့ program ကို ချိတ်ဆက်ပေးပါတယ်။ ဂိမ်းတစ်ခုမှာ 'key နှိပ်ရင် ကားရွှေ့' ဆိုတာမျိုး Event နဲ့ လုပ်ပါတယ်။ ကျွန်တော်တို့ playground မှာတော့ 'Run' နှိပ်တာ = အလံ နှိပ်တာနဲ့ တူပါတယ်။",
        },
      ],
      quiz: [
        {
          q: "Event block တွေရဲ့ အဓိက အလုပ်က ဘာလဲ။",
          options: [
            "အရောင် ပြောင်းဖို့",
            "program ဘယ်အချိန် စမလဲ ဆုံးဖြတ်ဖို့",
            "ကြောင် ကို ကြီးစေဖို့",
            "အသံ ထွက်ဖို့",
          ],
          answer: 1,
        },
      ],
    },
    // 9 ── Repeat challenge (staircase)
    {
      slug: "staircase",
      title: "လှေကား ပုံစံ ဆွဲမယ်",
      summary: "Loop ကို အသုံးပြုပြီး ပုံစံ ထပ်ခါ ဆွဲမယ်။",
      minutes: 10,
      kind: "scratch",
      sections: [
        {
          heading: "စိန်ခေါ်မှု",
          body: "«ခဲတံ ချ» ပြီး loop သုံးပြီး လှေကား (staircase) ပုံစံ ဆွဲကြည့်ပါ — «ရှေ့သွား ၊ ညာဘက် ၉၀° ၊ ရှေ့သွား ၊ ဘယ်ဘက် ၉၀°» ကို အကြိမ်ကြိမ် ထပ်လုပ်ပါ။",
        },
        {
          heading: "စမ်းသပ်ပါ",
          body: "ခြေလှမ်းအရေအတွက်၊ ထပ်လုပ်တဲ့ အကြိမ်ရေ ပြောင်းပြီး ပုံပြောင်းသွားတာ ကြည့်ပါ။ ကိုယ်ပိုင် ဒီဇိုင်း ဖန်တီးကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "penDown" },
          { kind: "repeat", arg: 4 },
          { kind: "move", arg: 40 },
          { kind: "turnRight", arg: 90 },
          { kind: "move", arg: 40 },
          { kind: "turnLeft", arg: 90 },
          { kind: "repeatEnd" },
        ],
        goal: { requireKinds: ["penDown", "repeat", "turnRight", "turnLeft"] },
      },
    },
    // 9b ── Forever loop
    {
      slug: "forever-loop",
      title: "အမြဲ ထပ်လုပ် (Forever)",
      summary: "«အမြဲ ထပ်လုပ်» block နဲ့ မရပ်တမ်း လုပ်ဆောင်စေမယ်။",
      minutes: 7,
      kind: "scratch",
      sections: [
        {
          heading: "Forever loop",
          body: "«အမြဲ ထပ်လုပ်» ဆိုတာ အတွင်းက block တွေကို ရပ်တန့်မထားဘဲ ထပ်ခါထပ်ခါ လုပ်စေတာပါ (ဂိမ်းတွေမှာ အသုံးများတယ်)။ ကျွန်တော်တို့ playground မှာတော့ အဆုံးမရှိ မဖြစ်အောင် အကြိမ်ရေ အနည်းငယ် ကန့်သတ်ထားပါတယ်။",
        },
        {
          heading: "စမ်းကြည့်ပါ",
          body: "«အမြဲ ထပ်လုပ် [ ရှေ့သွား ၊ ညာဘက် ၉၀° လှည့် ]» — ဇာတ်ကောင် စက်ဝိုင်းလို ပတ်နေတာ တွေ့ရမယ်။ ခဲတံ ချထားရင် ပုံ ဆွဲသွားမယ်။",
        },
      ],
      scratch: {
        starter: [
          { kind: "penDown" },
          { kind: "forever" },
          { kind: "move", arg: 50 },
          { kind: "turnRight", arg: 72 },
          { kind: "repeatEnd" },
        ],
        goal: { requireKinds: ["forever", "move"] },
      },
    },
    // 9c ── Variables & lists (arrays)
    {
      slug: "variables-lists",
      title: "ကိန်းရှင် & စာရင်း (Array)",
      summary: "ကိန်း (counter) နဲ့ စာရင်း (list/array) block တွေ သုံးကြမယ်။",
      minutes: 9,
      kind: "scratch",
      sections: [
        {
          heading: "ကိန်းရှင် (Variable)",
          body: "ကိန်းရှင် ဆိုတာ တန်ဖိုး တစ်ခု သိမ်းထားတဲ့ 'ဗူး' လိုပါ။ «ကိန်း ကို ၀ ထား» ပြီး loop ထဲမှာ «ကိန်း ကို ၁ ပေါင်း» လုပ်ရင် အရေအတွက် တွက်နိုင်ပါတယ်။ «ကိန်း တန်ဖိုး ပြော» နဲ့ ကြည့်လို့ရတယ်။ ဇာတ်ခုံအောက်က monitor မှာ တန်ဖိုး ပေါ်ပါလိမ့်မယ်။",
        },
        {
          heading: "စာရင်း (List / Array)",
          body: "စာရင်း (array) ဆိုတာ တန်ဖိုး အများကြီး အစဉ်လိုက် သိမ်းထားတဲ့ 'ဗူးတန်း' ပါ။ «စာရင်းထဲ ... ထည့်» နဲ့ တစ်ခုချင်း ထည့်၊ «စာရင်း ရှင်း» နဲ့ ဖျက်၊ «စာရင်း တစ်ခုလုံး ပြော» နဲ့ အားလုံး ကြည့်နိုင်ပါတယ်။",
        },
        {
          heading: "ရည်မှန်းချက်",
          body: "loop သုံးပြီး ကိန်းကို ရေတွက်၊ စာရင်းထဲ အသီး (🍎🍌🍊) တွေ ထည့်ကြည့်ပါ — monitor မှာ တန်ဖိုးတွေ ပြောင်းသွားတာ ကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "setVar", arg: 0 },
          { kind: "repeat", arg: 3 },
          { kind: "changeVar", arg: 1 },
          { kind: "listAdd", arg: "🍎" },
          { kind: "repeatEnd" },
          { kind: "sayVar" },
        ],
        goal: { requireKinds: ["setVar", "changeVar", "listAdd"] },
      },
    },
    // 10 ── Quiz
    {
      slug: "concepts-quiz",
      title: "စစ်ဆေးမှု — အခြေခံ သဘောတရား",
      summary: "Block coding အခြေခံ သဘောတရားတွေ ပြန်လည် စစ်ဆေးမယ်။",
      minutes: 6,
      kind: "quiz",
      quiz: [
        {
          q: "Sprite ဆိုတာ ဘာလဲ။",
          options: [
            "ဇာတ်ခုံပေါ်က ဇာတ်ကောင်",
            "ခဲတံ အရောင်",
            "ဂဏန်း တစ်လုံး",
            "ကီးဘုတ် ခလုတ်",
          ],
          answer: 0,
        },
        {
          q: "«ခဲတံ ချ» လုပ်ပြီး ရွှေ့ရင် ဘာဖြစ်မလဲ။",
          options: [
            "ဘာမှ မဖြစ်",
            "မျဉ်း ဆွဲသွားမယ်",
            "ကြောင် ကြီးလာမယ်",
            "ကြောင် ပျောက်သွားမယ်",
          ],
          answer: 1,
        },
        {
          q: "လေးထောင့် (စတုဂံ) ဆွဲဖို့ ဘယ်လို loop သုံးမလဲ။",
          options: [
            "၃ ကြိမ် ထပ်လုပ်၊ ၁၂၀° လှည့်",
            "၄ ကြိမ် ထပ်လုပ်၊ ၉၀° လှည့်",
            "၅ ကြိမ် ထပ်လုပ်၊ ၄၅° လှည့်",
            "၆ ကြိမ် ထပ်လုပ်၊ ၆၀° လှည့်",
          ],
          answer: 1,
        },
        {
          q: "Loop သုံးရတဲ့ အဓိက အကျိုးက ဘာလဲ။",
          options: [
            "အရောင် လှဖို့",
            "တူညီတဲ့ အလုပ်ကို ထပ်ခါ မရေးရအောင်",
            "sprite အသစ် ထည့်ဖို့",
            "အသံ ထည့်ဖို့",
          ],
          answer: 1,
        },
      ],
    },
    // 11 ── Free build
    {
      slug: "free-build",
      title: "ကိုယ်ပိုင် ပုံဖန်တီးမယ်",
      summary: "သင်ယူထားသမျှ block တွေနဲ့ လွတ်လပ်စွာ ဖန်တီးပါ။",
      minutes: 12,
      kind: "scratch",
      sections: [
        {
          heading: "လွတ်လပ်စွာ ဖန်တီးပါ",
          body: "အခု သင်ယူထားသမျှ block အားလုံး (ရွှေ့၊ လှည့်၊ loop၊ ခဲတံ၊ အရောင်၊ ပြော) ကို ပေါင်းစပ်ပြီး ကိုယ်ပိုင် ပန်းချီ ဒါမှမဟုတ် ပုံစံ တစ်ခု ဖန်တီးပါ။ မှားတာ ကြောက်စရာ မလိုပါ — စမ်းရင်း သင်ယူတာပါ။",
        },
        {
          heading: "အကြံပြုချက်",
          body: "«၆ ကြိမ် ထပ်လုပ် [ ၄ ကြိမ် ထပ်လုပ် (စတုဂံ) ၊ လှည့် ]» လို loop ထဲ loop ထည့်ပြီး ပန်း (flower) ပုံ ဆွဲကြည့်ပါ။",
        },
      ],
      scratch: {
        starter: [
          { kind: "penDown" },
          { kind: "repeat", arg: 6 },
          { kind: "move", arg: 60 },
          { kind: "turnRight", arg: 60 },
          { kind: "penColor" },
          { kind: "repeatEnd" },
        ],
      },
    },
    // 12 ── Wrap up
    {
      slug: "next-steps",
      title: "ရှေ့ဆက်ရန် လမ်းကြောင်း",
      summary: "Block coding ပြီးရင် ဘယ်ဆက်သွားမလဲ။",
      minutes: 5,
      kind: "reading",
      sections: [
        {
          heading: "ဂုဏ်ယူပါတယ်! 🎉",
          body: "Sprite၊ motion၊ loop၊ pen၊ event စတဲ့ coding အခြေခံ သဘောတရားတွေ သင်ယူပြီးပါပြီ။ ဒီ တွေးခေါ်နည်း (sequence၊ loop၊ event) က programming language တိုင်းမှာ တူညီပါတယ်။",
        },
        {
          heading: "နောက်တစ်ဆင့်",
          body: "စာသားကုဒ် (text code) စမ်းချင်ရင် ဒီ platform ရဲ့ Python သင်တန်း၊ Web (HTML/CSS/JS) သင်တန်းတွေ ဆက်လေ့လာနိုင်ပါတယ်။ Block တွေမှာ သင်ယူထားတဲ့ loop နဲ့ logic တွေဟာ အဲဒီမှာလည်း အသုံးဝင်ပါလိမ့်မယ်။",
        },
      ],
    },
  ],
};
