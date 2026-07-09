// Burmese (my) lesson-content overlay. Titles, summaries, section text and
// quizzes are translated; code samples stay in code. Technical terms keep
// their standard English form with a Burmese explanation. Missing entries
// fall back to English automatically.

import type { LearnOverlay } from "@/lib/learn/i18n";

export const MY_OVERLAY: LearnOverlay = {
  // ─────────────────────────── STEM (kids) ────────────────────────────────
  stem: {
    title: "သိပ္ပံ အခြေခံများ",
    description: "အပင်၊ ရေနဲ့ အလင်းအကြောင်း ပျော်စရာ သိပ္ပံ — ငယ်ရွယ်တဲ့ လေ့လာသူများအတွက်။",
    lessons: {
      "how-plants-grow": {
        title: "အပင်တွေ ဘယ်လိုကြီးထွားလဲ",
        summary: "မျိုးစေ့၊ မြေဆီ၊ နေရောင်နဲ့ ရေ — အပင်တစ်ပင်ရဲ့ ချက်ပြုတ်နည်း။",
        sections: [
          {
            heading: "မျိုးစေ့က အထုပ်လေးတစ်ခု",
            body: "မျိုးစေ့တိုင်းထဲမှာ အပင်ပျိုလေးတစ်ပင်နဲ့ အစားအစာ အနည်းငယ် ပါပါတယ်။ ရေ၊ အပူနဲ့ လေ ရတဲ့အခါ နိုးထပြီး ကြီးထွားလာတယ်။ ဒီနိုးထတာကို germination (အညှောက်ထွက်ခြင်း) လို့ ခေါ်ပါတယ်။",
          },
          {
            heading: "အပင်လိုအပ်တဲ့ အရာ ၄ ခု",
            body: "အပင်တွေဟာ အလင်း၊ ရေ၊ လေနဲ့ မြေဆီထဲက အာဟာရ လိုပါတယ်။ အရွက်တွေက နေရောင်ဖမ်း၊ အမြစ်တွေက ရေသောက်ပြီး အပင်ကို ခိုင်ခံ့စေ၊ အရွက်ပေါ်က အပေါက်ကလေးတွေက လေရှူတယ်။",
          },
          {
            heading: "အလင်းကနေ အစားအစာ ဖန်တီးခြင်း",
            body: "အပင်တွေဟာ နေရောင်ကို သုံးပြီး ကိုယ်ပိုင်အစားအစာ ဖန်တီးတယ် — ဒါကို photosynthesis (အလင်းစားခြင်း) လို့ ခေါ်တယ်။ ကာဗွန်ဒိုင်အောက်ဆိုက်နဲ့ ရေကို သကြားနဲ့ အောက်ဆီဂျင် ဖြစ်အောင် ပြောင်းတယ် — ငါတို့ ရှူတဲ့ အောက်ဆီဂျင်ပါ!",
          },
        ],
      },
      "plants-quiz": {
        title: "အပင်စွမ်းအား Quiz",
        summary: "အပင်ကြီးထွားပုံအကြောင်း သင်လေ့လာထားတာ စစ်ဆေးပါ။",
        quiz: [
          {
            q: "မျိုးစေ့ နိုးထပြီး ကြီးထွားစတာကို ဘာလို့ ခေါ်လဲ?",
            options: ["အညှောက်ထွက်ခြင်း", "ဆောင်းခိုခြင်း", "အငွေ့ပျံခြင်း", "ဆွဲငင်အား"],
            explain: "Germination ဆိုတာ မျိုးစေ့ အညှောက်ထွက်ပြီး ကြီးထွားစတာပါ။",
          },
          {
            q: "အပင်ရဲ့ ဘယ်အစိတ်အပိုင်းက မြေဆီကနေ ရေသောက်လဲ?",
            options: ["အရွက်များ", "ပန်းများ", "အမြစ်များ", "မျိုးစေ့များ"],
            explain: "အမြစ်တွေက ရေစုပ်ယူပြီး အပင်ကို နေရာမှာ ခိုင်ခံ့စေတယ်။",
          },
          {
            q: "ငါတို့ ရှူဖို့လိုတဲ့ ဘယ်ဓာတ်ငွေ့ကို အပင်တွေ ထုတ်ပေးလဲ?",
            options: ["ကာဗွန်ဒိုင်အောက်ဆိုက်", "အောက်ဆီဂျင်", "ဟီလီယမ်", "ရေငွေ့"],
            explain: "Photosynthesis က အပင်အစာ ဖန်တီးရင်း အောက်ဆီဂျင် ထုတ်ပေးတယ်။",
          },
        ],
      },
      "water-and-light": {
        title: "ရေနဲ့ အလင်း စမ်းသပ်ချက်များ",
        summary: "အကြီးလူတစ်ယောက်နဲ့အတူ အိမ်မှာ လုပ်ကြည့်လို့ရတဲ့ လွယ်ကူလုံခြုံတဲ့ အရာများ။",
        sections: [
          {
            heading: "သက်တံရောင် ကန်စွန်းရွက်",
            body: "ကန်စွန်းတစ်တံကို အစားအသောက်ဆိုးဆေး အနည်းငယ်ထည့်ထားတဲ့ ရေခွက်ထဲ ထည့်ပါ။ တစ်ရက်ကြာရင် အရောင်က ကန်စွန်းပေါ် တက်လာမယ် — ဒါက အပင်ထဲက ပြွန်ကလေးတွေထဲ ရေရွေ့လျားနေတာပါ။",
          },
          {
            heading: "အလင်းဆီ လှမ်းခြင်း",
            body: "အပင်ငယ်တစ်ပင်ကို ပြတင်းပေါက်နားမှာ ရက်အနည်းငယ် ထားပါ။ အရွက်တွေ အလင်းဘက် လှည့်တာ သတိထားကြည့်ပါ။ အပင်တွေက အစာပိုဖန်တီးဖို့ အလင်းဆီ လှည့်ကြီးထွားတယ် — ဒါကို phototropism လို့ ခေါ်တယ်။",
          },
        ],
      },
    },
  },

  // ────────────────────── Electronics & IoT ───────────────────────────────
  "electronics-iot": {
    title: "အီလက်ထရွန်းနစ်နဲ့ IoT",
    description: "စမတ်စိုက်ပျိုးရေးအတွက် sensor၊ circuit နဲ့ ချိတ်ဆက်ကိရိယာများ။",
    lessons: {
      "what-is-a-sensor": {
        title: "Sensor ဆိုတာ ဘာလဲ?",
        summary: "လက်တွေ့ကမ္ဘာကို ဂဏန်းအဖြစ် ပြောင်းပေးတဲ့ ကိရိယာများ။",
        sections: [
          {
            heading: "Sensor က ကမ္ဘာကို တိုင်းတာတယ်",
            body: "Sensor ဆိုတာ ရုပ်ဝတ္ထုဆိုင်ရာ တစ်ခုခု — အပူချိန်၊ အလင်း၊ စိုထိုင်းဆ၊ အကွာအဝေး — ကို တိုင်းတာပြီး ကွန်ပျူတာဖတ်နိုင်တဲ့ လျှပ်စစ်signal အဖြစ် ပြောင်းပေးတဲ့ အီလက်ထရွန်းနစ်ကိရိယာ ကလေးပါ။ သင့်ဖုန်းမှာလည်း အများကြီးပါတယ်။",
          },
          {
            heading: "စမတ်ဖမ်းမှာ Sensor များ",
            body: "GreenWave ဖမ်းတွေမှာ အပူချိန်၊ စိုထိုင်းဆနဲ့ မြေစိုဓာတ်အတွက် sensor သုံးတယ်။ ဖတ်ချက်တိုင်းက စနစ်သိမ်းဆည်းပြီး ဂရပ်ဆွဲတဲ့ ဂဏန်းဖြစ်လာတယ်။ တန်ဖိုးက ကန့်သတ်ချက်ကျော်ရင် (ဥပမာ စိုထိုင်းဆ ၇၀% ကျော်) automation rule က ပန်ကာဖွင့်တာမျိုး လုပ်နိုင်တယ်။",
          },
          {
            heading: "Analog နဲ့ Digital",
            body: "Sensor အချို့က analog signal ပေးတယ် — ဒိုင်ခွက်လို တန်ဖိုးအဆက်မပြတ်။ တချို့က digital — on/off ရှင်းရှင်း ဒါမှမဟုတ် ဂဏန်းအတိအကျ။ microcontroller လို့ခေါ်တဲ့ ကွန်ပျူတာကလေးက sensor ဖတ်ပြီး နောက်ဘာလုပ်ရမလဲ ဆုံးဖြတ်တယ်။",
          },
        ],
      },
      "build-a-circuit": {
        title: "Circuit တည်ဆောက်ခြင်း (ဂိမ်း)",
        summary: "ဘက်ထရီ၊ ဝါယာ၊ ခလုတ်နဲ့ LED ချိတ်ပြီး မီးလင်းအောင်လုပ်ပါ။",
        sections: [
          {
            heading: "လျှပ်စစ်က ကွင်းဆက် လိုတယ်",
            body: "လျှပ်စစ်က circuit လို့ခေါ်တဲ့ ပြည့်စုံတဲ့ ကွင်းဆက်ပတ်လမ်းတစ်ခုပတ်ပြီးမှ စီးဆင်းတယ်။ ဘက်ထရီ၊ ဝါယာ၊ ခလုတ်နဲ့ LED ကို ကွင်းအပြည့်ချိတ်ပြီး ခလုတ်ပိတ်လိုက်ရင် LED လင်းလာမယ်! ကွင်းဆက်ကို ဘယ်နေရာဖြတ်ဖြတ် မီးပျက်တယ်။",
          },
        ],
      },
      "sending-data-to-the-cloud": {
        title: "Cloud ဆီ Data ပို့ခြင်း",
        summary: "Sensor ဖတ်ချက်တစ်ခု သင်မြင်နိုင်တဲ့ app ဆီ ဘယ်လိုရောက်လဲ။",
        sections: [
          {
            heading: "ကိရိယာကနေ အင်တာနက်ဆီ",
            body: "IoT (Internet of Things) ကိရိယာ ဆိုတာ sensor ပါပြီး အင်တာနက်ချိတ်ထားတဲ့ ဘာမဆိုပါ။ microcontroller က sensor ဖတ်၊ ဂဏန်းကို message ကလေးအဖြစ်ထုပ်ပြီး Wi-Fi ဒါမှမဟုတ် mobile network ကနေ cloud ထဲက server ဆီ ပို့တယ်။",
          },
          {
            heading: "MQTT: ကိရိယာကလေးများရဲ့ ဘာသာစကား",
            body: "IoT ကိရိယာအများစုက MQTT — ပေါ့ပါးတဲ့ messaging စနစ်နဲ့ ပြောဆိုတယ်။ ကိရိယာက ဖတ်ချက်ကို topic (ဥပမာ farm/zone1/temperature) ဆီ 'publish' လုပ်ပြီး server က 'subscribe' လုပ်ပြီး လက်ခံတယ်။",
          },
          {
            heading: "Data သိမ်းပြီး ပြသခြင်း",
            body: "Cloud server က ဖတ်ချက်တိုင်းကို အချိန်တံဆိပ်နဲ့ database ထဲသိမ်းတယ်။ App က အဲဒီ history ဖတ်ပြီး ဂရပ်ဆွဲတယ် — GreenWave စမတ်ဖမ်း dashboard လုပ်တဲ့အတိုင်းပါ။ Data က live ဖြစ်လို့ ဖတ်ချက်အသစ်ရောက်တာနဲ့ dashboard ချက်ချင်း update ဖြစ်တယ်။",
          },
        ],
      },
      "electronics-iot-quiz": {
        title: "အီလက်ထရွန်းနစ်နဲ့ IoT Quiz",
        summary: "Sensor၊ circuit နဲ့ IoT အကြောင်း သင်လေ့လာထားတာ စစ်ပါ။",
        quiz: [
          {
            q: "Sensor က ဘာလုပ်လဲ?",
            options: ["ဖိုင်သိမ်း", "ရုပ်ဝတ္ထုတစ်ခုကို ကွန်ပျူတာဖတ်နိုင်တဲ့ signal အဖြစ် ပြောင်း", "စက္ကူ print", "ဘက်ထရီ အားသွင်း"],
            explain: "Sensor တွေက ကမ္ဘာကို တိုင်းတာပြီး လျှပ်စစ်signal အဖြစ် ပြောင်းတယ်။",
          },
          {
            q: "လျှပ်စစ်က … ပတ်ပြီးမှ စီးဆင်းတယ်",
            options: ["မျဉ်းဖြောင့်", "ပြည့်စုံတဲ့ ကွင်းဆက် (circuit)", "အဆုံးတစ်ဖက်ရှိတဲ့ ဝါယာတစ်ချောင်း", "သံလိုက်"],
            explain: "လျှပ်စီးဖို့ circuit က ပြည့်စုံတဲ့ ကွင်းဆက် ဖြစ်ရမယ်။",
          },
          {
            q: "IoT ဆိုတာ ဘာအတိုကောက်လဲ?",
            options: ["Internet of Things", "Input of Text", "Index of Tables", "Images or Text"],
          },
          {
            q: "IoT ကိရိယာအများစုက ဖတ်ချက်ပို့ဖို့ ဘယ်ပေါ့ပါးတဲ့စနစ်သုံးလဲ?",
            options: ["MQTT", "PDF", "HTML", "USB"],
            explain: "MQTT က ကိရိယာများအတွက် ပေါ့ပါးတဲ့ publish/subscribe messaging protocol ပါ။",
          },
        ],
      },
    },
  },

  // ─────────────────────────── Robotics & AI ──────────────────────────────
  robotics: {
    title: "Robotics နဲ့ AI",
    description: "Robot တွေ ဘယ်လို sense/think/move လုပ်လဲ — robot programming ဂိမ်းနဲ့။",
    lessons: {
      "what-is-a-robot": {
        title: "Robot ဆိုတာ ဘာလဲ?",
        summary: "Sense → Think → Act — robot တိုင်း run တဲ့ ကွင်းဆက်။",
        sections: [
          {
            heading: "Sense → Think → Act",
            body: "Robot ဆိုတာ ပတ်ဝန်းကျင်ကို ခံစား(sense)၊ ဘာလုပ်ရမလဲ ဆုံးဖြတ်(think)ပြီး လုပ်ဆောင်(act)တဲ့ စက်ပါ။ ဒီကွင်းဆက်ကို တစ်စက္ကန့်ကို အကြိမ်များစွာ ထပ်ခါလုပ်တယ်။ Robot vacuum က နံရံခံစား၊ လှည့်ဖို့ဆုံးဖြတ်၊ ဝေးဝေးမောင်းသွား။",
          },
          {
            heading: "Sensor က robot ရဲ့ အာရုံ",
            body: "Sensor တွေက လက်တွေ့ကမ္ဘာကို robot သုံးနိုင်တဲ့ ဂဏန်းအဖြစ် ပြောင်းတယ် — အကွာအဝေး sensor၊ ကင်မရာ၊ အပူချိန်နဲ့ အလင်း sensor။ GreenWave စမတ်ဖမ်းမှာ sensor တွေက အပူချိန်၊ စိုထိုင်းဆ၊ မြေစိုဓာတ်ဖတ်တယ်။",
          },
          {
            heading: "Actuator က ရွေ့လျားစေတယ်",
            body: "Actuator တွေက ကြွက်သားတွေပါ: ဘီးလည်စေတဲ့ မော်တာ၊ မ,တဲ့ လက်မောင်း၊ ဖွင့်တဲ့ valve။ Robot ရဲ့ program က sensor ပြောတာနဲ့ actuator လုပ်တာကို ချိတ်ဆက်ပေးတယ်။",
          },
        ],
      },
      "program-a-robot": {
        title: "Robot ကို Program ရေးခြင်း (ဂိမ်း)",
        summary: "Robot ကို ပန်းတိုင်ရောက်အောင် command စာရင်း ရေးပါ။",
        sections: [
          {
            heading: "Sequencing: အစီအစဉ် အရေးကြီးတယ်",
            body: "Robot ကို program ရေးတာက command တွေကို မှန်ကန်တဲ့ အစီအစဉ်နဲ့ ပေးတာပါ — ဒါကို sequencing လို့ခေါ်ပြီး coding အားလုံးရဲ့ အခြေခံပါ။ လမ်းကြောင်းစီစဉ်၊ ရွေ့ချက်ထည့်၊ Run နှိပ်ပြီး robot လိုက်လုပ်တာ ကြည့်ပါ။",
          },
        ],
      },
      "how-ai-helps-farms": {
        title: "AI က ဖမ်းတွေကို ဘယ်လိုကူညီလဲ",
        summary: "ရိုးရှင်းတဲ့ rule ကနေ စမတ်ခန့်မှန်းချက်များအထိ။",
        sections: [
          {
            heading: "Rule နဲ့ Learning",
            body: "အရိုးရှင်းဆုံး 'စမတ်' စနစ်တွေက လူရေးတဲ့ rule လိုက်နာတယ်: IF စိုထိုင်းဆ > ၇၀% THEN ပန်ကာဖွင့်။ AI (Artificial Intelligence) က ပိုသွားတယ် — data အဟောင်းများကနေ ပုံစံလေ့လာပြီး နောက်ဘာဖြစ်မလဲ ခန့်မှန်းတယ်၊ ဥပမာ သီးနှံ ဘယ်တော့ ရိတ်လို့ရမလဲ။",
          },
          {
            heading: "GreenWave မှာ မြင်ရတဲ့ AI",
            body: "စမတ်ဖမ် automation rule တွေက rule-based အမျိုးအစားပါ — ယုံကြည်ရပြီး နားလည်လွယ်တယ်။ Sensor history များလာတာနဲ့ AI model တွေက လူမြင်မိချင်မှမြင်မိတဲ့ trend တွေ — ဥပမာ အပင်ဖိစီးမှုရဲ့ အစောပိုင်းလက္ခဏာ — ကို တွေ့နိုင်တယ်။",
          },
          {
            heading: "AI ကို လုံခြုံပြီး တရားမျှတအောင်",
            body: "AI က သူ့ data ကောင်းသလောက်ပဲ ကောင်းတယ်။ engineer ကောင်းတွေက ခန့်မှန်းချက်တိကျမှု စစ်ဆေး၊ ဆုံးဖြတ်ပုံရှင်းပြ၊ အရေးကြီးဆုံးဖြတ်ချက်တွေမှာ လူကို အမြဲတမ်း ထိန်းချုပ်ခွင့်ပေးထားတယ်။",
          },
        ],
      },
      "robotics-quiz": {
        title: "Robotics နဲ့ AI Quiz",
        summary: "Robot နဲ့ AI အကြောင်း သင်လေ့လာထားတာ စစ်ပါ။",
        quiz: [
          {
            q: "Robot တိုင်း ထပ်ခါလုပ်တဲ့ ကွင်းဆက်က ဘာလဲ?",
            options: ["Start → Stop", "Sense → Think → Act", "Buy → Sell", "Up → Down"],
            explain: "Robot တွေက ပတ်ဝန်းကျင်ခံစား၊ ဆုံးဖြတ်၊ လုပ်ဆောင်တာ ဆက်တိုက်လုပ်တယ်။",
          },
          {
            q: "လက်တွေ့ကမ္ဘာကို robot သုံးနိုင်တဲ့ ဂဏန်းအဖြစ် ဘာက ပြောင်းလဲ?",
            options: ["Actuator", "ဘီး", "Sensor", "ဘက်ထရီ"],
          },
          {
            q: "Command တွေကို မှန်ကန်တဲ့ အစီအစဉ်နဲ့ ပေးတာကို ဘာလို့ခေါ်လဲ?",
            options: ["Sequencing", "ဆေးရေးခြင်း", "အားသွင်းခြင်း", "မှန်းဆခြင်း"],
            explain: "Sequencing က programming ရဲ့ အခြေခံပါ။",
          },
          {
            q: "အရေးကြီးဆုံးဖြတ်ချက်တွေမှာ AI ကို ဘယ်လိုသုံးရင် အလုံခြုံဆုံးလဲ?",
            options: ["အကုန် သူ့ဟာသူ ဆုံးဖြတ်ခိုင်း", "လူကို ထိန်းချုပ်ခွင့်ပေးပြီး တိကျမှုစစ်", "data ဘယ်တော့မှ မမှတ်", "sensor အားလုံးပိတ်"],
          },
        ],
      },
    },
  },

  // ────────────────────────── Applied agri ────────────────────────────────
  agri: {
    title: "အသုံးချ စိုက်ပျိုးရေးသိပ္ပံ",
    description: "Hydroponics၊ အာဟာရနဲ့ data-driven စိုက်ပျိုးရေး ခေတ်မီဖမ်းများအတွက်။",
    lessons: {
      "hydroponics-basics": {
        title: "Hydroponics အခြေခံ",
        summary: "မြေမပါဘဲ စိုက်ခြင်း — အာဟာရဓာတ်ရည် ဘယ်လိုအလုပ်လုပ်လဲ။",
        sections: [
          {
            heading: "မြေမဲ့ စိုက်ပျိုးခြင်း",
            body: "Hydroponics က မြေအစား အာဟာရကြွယ်ဝတဲ့ ရေဓာတ်ရည်ထဲ အပင်စိုက်တယ်။ အမြစ်တွေက ပျော်ဝင်နေတဲ့ သတ္တုဓာတ်တွေ တိုက်ရိုက်ရလို့ ကွင်းစိုက်ထက် မကြာခဏ ပိုမြန်ကြီးပြီး ရေပိုသက်သာတယ်။",
          },
          {
            heading: "EC နဲ့ pH",
            body: "ဂဏန်းနှစ်ခု အရေးအကြီးဆုံး: EC (electrical conductivity) က အာဟာရ ဘယ်လောက်ပျော်ဝင်နေလဲ တိုင်း၊ pH က အက်ဆစ်ဓာတ်တိုင်းတယ်။ သီးနှံအများစုက pH 5.5–6.5 မှာ အကောင်းဆုံးဖြစ်တယ်။ GreenWave tool တွေမှာ EC/PPM converter နဲ့ VPD calculator ပါတယ်။",
          },
          {
            heading: "Sensor နဲ့ စောင့်ကြည့်ခြင်း",
            body: "IoT sensor တွေက အပူချိန်၊ စိုထိုင်းဆ၊ EC နဲ့ pH ကို real time ခြေရာခံတယ်။ GreenWave စမတ်ဖမ် dashboard က ဒီဖတ်ချက်တွေကို ဂရပ်ပြောင်းပြီး automation rule ဖြစ်စေနိုင်တယ် — ဥပမာ စိုထိုင်းဆမြင့်လာရင် ပန်ကာဖွင့်။",
          },
        ],
      },
      "agri-quiz": {
        title: "စိုက်ပျိုးရေးသိပ္ပံ Quiz",
        summary: "Hydroponics နဲ့ စောင့်ကြည့်မှု ဗဟုသုတ စစ်ပါ။",
        quiz: [
          {
            q: "အာဟာရဓာတ်ရည်ထဲ EC က ဘာတိုင်းလဲ?",
            options: ["အရောင်", "ပျော်ဝင်နေတဲ့ အာဟာရပမာဏ", "အပူချိန်", "အလင်းအဆင့်"],
            explain: "EC က အာဟာရ ပိုပျော်ဝင်လာတာနဲ့ တက်လာတယ်။",
          },
          {
            q: "Hydroponic သီးနှံအများစုကို ဘယ် pH range သင့်တော်လဲ?",
            options: ["1–2", "5.5–6.5", "8–9", "11–12"],
          },
          {
            q: "စမတ်ဖမ် automation rule က ဘာလုပ်နိုင်လဲ?",
            options: ["ဘာမှမလုပ်၊ data ပဲပြ", "ဖတ်ချက်က ကန့်သတ်ချက်ကျော်ရင် ပန်ကာဖွင့်တာမျိုး လုပ်ဆောင်ချက် ဖြစ်စေ", "အပင်တွေ အစားထိုး", "အာကာသမှာသာ အစားထွက်"],
          },
        ],
      },
    },
  },
  // ─────────────────────────── HTML ───────────────────────────────────────
  html: {
    title: "HTML သင်တန်း",
    description: "ဝဘ်စာမျက်နှာတိုင်းရဲ့ ဘာသာစကား — ပထမဆုံး tag ကနေ စာမျက်နှာအပြည့် layout အထိ။",
    lessons: {
      "html-intro": {
        title: "HTML မိတ်ဆက်",
        summary: "HTML ဆိုတာဘာလဲ၊ စာမျက်နှာတစ်ခု ဘယ်လိုတည်ဆောက်လဲ။",
        sections: [
          { heading: "HTML က ဖွဲ့စည်းပုံကို ဖော်ပြတယ်", body: "HTML (HyperText Markup Language) က browser ကို စာမျက်နှာရဲ့ အစိတ်အပိုင်းတစ်ခုစီ ဘာဖြစ်လဲ ပြောပြတယ် — ခေါင်းစဉ်၊ စာပိုဒ်၊ ခလုတ်။ Element တွေကို angle bracket ထဲမှာ tag အဖြစ်ရေးပြီး အများစုက အဖွင့်/အပိတ် အတွဲလိုက် ရှိတယ်။" },
          { heading: "စာမျက်နှာ အပြည့်အစုံတစ်ခု", body: "တကယ့်စာမျက်နှာက <!DOCTYPE html> နဲ့စပြီး အားလုံးကို <html> ထဲ ထည့်တယ်။ စာမျက်နှာအချက်အလက်က <head> ထဲ၊ မြင်ရတဲ့ content က <body> ထဲ။ Playground က အဲဒီ shell ကို သင့်အတွက် ရေးပေးထားပြီး body ကိုပဲ ပြင်ရမယ်။ ပြင်တိုင်း Run နှိပ်ပါ!" },
        ],
      },
      "html-text": {
        title: "ခေါင်းစဉ်နဲ့ စာသား",
        summary: "ခေါင်းစဉ်အဆင့် ၆ ဆင့်၊ စာပိုဒ်၊ bold၊ italic နဲ့ စာကြောင်းခြား။",
        sections: [
          { heading: "ခေါင်းစဉ် h1–h6", body: "ခေါင်းစဉ်တွေက <h1> (အရေးအကြီးဆုံး၊ စာမျက်နှာတစ်ခုမှာ တစ်ခုသာ) ကနေ <h6> အထိ ရှိတယ်။ Search engine နဲ့ screen reader တွေက စာမျက်နှာအကြမ်းဖျင်း နားလည်ဖို့ ဒါတွေကို သုံးတယ်။" },
          { heading: "Inline စာသား tag များ", body: "<b> နဲ့ <strong> က စာလုံးထူ၊ <i> နဲ့ <em> က စာစောင်း၊ <mark> က highlight၊ <small> က ချုံ့၊ <br> က စာပိုဒ်အသစ်မစဘဲ စာကြောင်းခြားပေးတယ်။" },
        ],
      },
      "html-links-images": {
        title: "Link နဲ့ ပုံများ",
        summary: "<a> နဲ့ စာမျက်နှာချိတ်၊ <img> နဲ့ ပုံပြ။",
        sections: [
          { heading: "Anchor (link)", body: "<a> tag က link ဖန်တီးတယ်။ href attribute ထဲမှာ သွားမယ့်နေရာ ပါတယ်။ tag နှစ်ခုကြားက စာသားက နှိပ်လို့ရတယ်။" },
          { heading: "ပုံများ", body: "<img> tag မှာ အပိတ် tag မလိုဘူး။ src က ပုံကို ညွှန်ပြီး alt က မမြင်နိုင်သူတွေအတွက် ဖော်ပြတယ် — alt အမြဲရေးပါ။ (Playground က network ပိတ်ထားလို့ ဒီမှာ emoji နဲ့ CSS သုံးပြီး 'ပုံ' ဆွဲပြထားတယ်။)" },
        ],
      },
      "html-lists-tables": {
        title: "စာရင်းနဲ့ ဇယားများ",
        summary: "အစက်စာရင်း၊ နံပါတ်စာရင်းနဲ့ data ဇယားများ။",
        sections: [
          { heading: "စာရင်းများ", body: "<ul> က အစက် (မစီ) စာရင်း၊ <ol> က နံပါတ် (စီ) စာရင်း လုပ်တယ်။ item တစ်ခုစီက <li> ထဲ ရှိတယ်။" },
          { heading: "ဇယားများ", body: "<table> က အတန်း (<tr>) တွေ ကိုင်ထားတယ်။ ခေါင်းစီးဆဲလ်က <th>၊ data ဆဲလ်က <td>။ ဇယားကို data အတွက်သာ သုံးပါ — page layout အတွက် မဟုတ်ဘူး။" },
        ],
      },
      "html-forms": {
        title: "Form နဲ့ Input များ",
        summary: "စာသားအကွက်၊ checkbox၊ dropdown နဲ့ ခလုတ်များ။",
        sections: [
          { heading: "Input စုဆောင်းခြင်း", body: "Form တွေက user ရိုက်တာ/ရွေးတာ စုတယ်။ <input> က type attribute နဲ့ စာသား၊ ဂဏန်း၊ checkbox စတာ ကိုင်တယ်၊ <select> က dropdown၊ <textarea> က စာသားအကွက်ကြီး၊ <label> က field ကို အမည်ပေးပြီး input ရဲ့ id ကို ညွှန်သင့်တယ်။" },
        ],
      },
      "html-semantic": {
        title: "Semantic Layout",
        summary: "header, nav, main, article, footer — အဓိပ္ပာယ်ရှိတဲ့ စာမျက်နှာများ။",
        sections: [
          { heading: "Semantic tag ဘာလို့လိုလဲ", body: "အားလုံးကို <div> နဲ့ ထုပ်မယ့်အစား၊ semantic tag တွေက နေရာတစ်ခုစီ ဘာလဲ ပြောတယ် — <header>, <nav>, <main>, <article>, <aside>, <footer>။ Screen reader နဲ့ search engine တွေ ဒါတွေကို အားကိုးပြီး CSS ကလည်း ရိုးရှင်းသွားတယ်။" },
        ],
      },
      "html-attributes": {
        title: "Attribute, id နဲ့ class",
        summary: "tag ပေါ်က ထပ်ဆောင်းအချက်အလက် — CSS နဲ့ JS ကိုင်တွယ်တဲ့ ချိတ်များ။",
        sections: [
          { heading: "name=\"value\" အတွဲများ", body: "Attribute တွေက အဖွင့် tag ထဲမှာ ရှိပြီး အချက်အလက် ထည့်တယ် — link မှာ href၊ ပုံမှာ src၊ input မှာ type။ အထူး နှစ်ခု နေရာတိုင်းမှာ ရှိတယ် — id က element တစ်ခုကို သီးသန့်အမည်ပေး၊ class က style အတွက် element အုပ်စုကို အမှတ်တံဆိပ်တပ်တယ်။" },
          { heading: "style နဲ့ title", body: "style attribute က element တစ်ခုတည်းကို inline CSS လုပ်တယ် (စမ်းသပ်ဖို့ အဆင်ပြေ၊ တကယ့် project မှာ ရှောင်ပါ)၊ title က hover လုပ်ရင် tooltip ပြတယ်။" },
        ],
      },
      "html-media": {
        title: "Audio, Video နဲ့ Iframe",
        summary: "အသံ၊ ရုပ်ရှင်နဲ့ တခြားစာမျက်နှာများ ထည့်သွင်းခြင်း။",
        sections: [
          { heading: "Video နဲ့ audio", body: "<video> နဲ့ <audio> tag တွေက media file ဖွင့်တယ်။ controls ထည့်ရင် user တွေ play/pause ခလုတ်ရမယ်၊ tag ထဲမှာ အရန်စာသား အမြဲထည့်ပါ။" },
          { heading: "Iframe", body: "<iframe> က တခြားစာမျက်နှာကို သင့်ထဲ ထည့်တယ် — မြေပုံ၊ video၊ dashboard။ မယုံရတဲ့ content ကို sandbox attribute အမြဲပေးသင့်တယ် (ဒီ site က community game တွေကို လုံခြုံအောင် run တဲ့ နည်းအတိအကျပါ)။" },
        ],
      },
      "html-quiz": {
        title: "HTML Quiz",
        summary: "HTML သင်တန်းတစ်ခုလုံးအတွက် မေးခွန်း ဆယ်ခု။",
      },
    },
  },
  // ─────────────────────────── CSS ────────────────────────────────────────
  css: {
    title: "CSS သင်တန်း",
    description: "အရောင်၊ နေရာချ၊ flexbox၊ grid နဲ့ animation — စာမျက်နှာတွေ လှအောင်လုပ်ပါ။",
    lessons: {
      "css-selectors": {
        title: "Selector နဲ့ အရောင်များ",
        summary: "element တွေကို ရွေးပြီး ဆေးသုတ်ပါ။",
        sections: [
          { heading: "ရွေးနည်း သုံးမျိုး", body: "tag selector (p) က စာပိုဒ်တိုင်းကို style လုပ်တယ်၊ class selector (.note) က class=\"note\" ရှိတဲ့ element တွေ၊ id selector (#title) က အဲဒီ id ရှိတဲ့ element တစ်ခုတည်း။ အရောင်တွေက အမည်၊ #3B6D11 လို hex၊ ဒါမှမဟုတ် rgb()/hsl() ဖြစ်နိုင်တယ်။" },
        ],
      },
      "css-box-model": {
        title: "Box Model",
        summary: "padding, border နဲ့ margin — element တိုင်းက box တစ်ခု။",
        sections: [
          { heading: "content → padding → border → margin", body: "element တိုင်းက စတုဂံ တစ်ခု။ padding က border အတွင်းဘက် နေရာလွတ်၊ margin က အပြင်ဘက် နေရာလွတ်။ ဒါကို နားလည်ရင် 'ဘာလို့ ကွက်လပ်ရှိတာလဲ' ပြဿနာ အများစု ဖြေရှင်းနိုင်တယ်။" },
        ],
      },
      "css-typography": {
        title: "စာသားနဲ့ Font များ",
        summary: "font အမျိုးအစား၊ အရွယ်၊ အထူနဲ့ အကွာအဝေး။",
        sections: [
          { heading: "စာလုံး ကိရိယာတန်ဆာ", body: "font-family က စာလုံးပုံစံရွေး (အရန်နဲ့)၊ font-size က အရွယ် (user zoom လုပ်လို့ရအောင် rem သုံးပါ)၊ font-weight က အထူ၊ line-height က စာကြောင်းအကွာ၊ text-align က စာသားနေရာ သတ်မှတ်တယ်။" },
        ],
      },
      "css-flexbox": {
        title: "Flexbox",
        summary: "တစ်ဖက်မြင် layout — အတန်း၊ ကော်လံ၊ ဗဟိုချ။",
        sections: [
          { heading: "display: flex", body: "container ပေါ်မှာ display:flex ထားရင် သားသမီး element တွေ အတန်းလိုက် စီတယ်။ justify-content က အတန်းတလျှောက်၊ align-items က ဖြတ်ကာ၊ gap က ကြားထဲ နေရာလွတ်ထည့်၊ flex-direction:column က ဒေါင်လိုက် စီပေးတယ်။" },
        ],
      },
      "css-grid": {
        title: "CSS Grid",
        summary: "card နဲ့ gallery အတွက် နှစ်ဖက်မြင် layout။",
        sections: [
          { heading: "အတန်းရော ကော်လံရော", body: "Grid က သားသမီးတွေကို နှစ်ဖက်မြင် နေရာချတယ်။ grid-template-columns က ကော်လံ သတ်မှတ် — repeat(3, 1fr) က ညီတူ ၃ ကော်လံ — gap က ဆဲလ်ခြား။ ဓာတ်ပုံ grid နဲ့ dashboard အတွက် ကိရိယာပါ။" },
        ],
      },
      "css-animation": {
        title: "Transition နဲ့ Animation",
        summary: "ချောမွေ့တဲ့ hover နဲ့ keyframe animation။",
        sections: [
          { heading: "Transition", body: "transition က property ပြောင်းတာကို ခုန်မယ့်အစား ချောမွေ့စေတယ် — hover effect အတွက် အကောင်းဆုံး။ @keyframes က animation ကို animation property နဲ့ တွဲသုံးတယ်။" },
        ],
      },
      "css-responsive": {
        title: "Responsive Design",
        summary: "media query — screen တိုင်းနဲ့ ကိုက်တဲ့ စာမျက်နှာတစ်ခု။",
        sections: [
          { heading: "Media query", body: "media query က screen အကျယ် 600px အောက်လို အခြေအနေ မှန်မှသာ style သက်ရောက်စေတယ်။ mobile-first ဒီဇိုင်း — ဖုန်း style ကို ပုံမှန်ရေးပြီး screen ကြီးတွေအတွက် min-width query ထည့်ပါ။" },
        ],
      },
      "css-position": {
        title: "Position နဲ့ Z-Index",
        summary: "relative, absolute, fixed, sticky — နဲ့ ထပ်နေတဲ့ အစီအစဉ်။",
        sections: [
          { heading: "position property", body: "static က ပုံမှန်။ relative က ပုံမှန်နေရာက ရွှေ့ပြီး သားသမီးတွေအတွက် အခြေခံဖြစ်။ absolute က နီးဆုံး positioned ancestor အလိုက် အတိအကျ နေရာချ။ fixed က screen မှာ ကပ်၊ sticky က scroll ကျော်ပြီးမှ ကပ်။ z-index က အပေါ်ဘယ်သူ ဆုံးဖြတ်။" },
        ],
      },
      "css-variables": {
        title: "CSS Variable များ",
        summary: "custom property — စာမျက်နှာတစ်ခုလုံးကို တစ်နေရာက theme လုပ်ပါ။",
        sections: [
          { heading: "တစ်ခါ သတ်မှတ်၊ နေရာတိုင်း သုံး", body: "custom property တွေက -- နဲ့စပြီး var() နဲ့ ဖတ်တယ်။ :root မှာ သတ်မှတ်ရင် rule တိုင်း မျှသုံးနိုင်တယ် — တစ်ကြောင်းပြောင်းရင် စာမျက်နှာတစ်ခုလုံး ပြန် theme ဖြစ်တယ်။ ဒီ site ရဲ့ theme ပြောင်းစနစ်က ဒီနည်းပါ။" },
        ],
      },
      "css-shadows-gradients": {
        title: "အရိပ်နဲ့ Gradient များ",
        summary: "UI ကို သပ်ရပ်စေတဲ့ အနက်နဲ့ အရောင်ရောစပ်မှု။",
        sections: [
          { heading: "box-shadow နဲ့ linear-gradient", body: "box-shadow က အနက်ထည့်တယ် (x, y, blur, အရောင်)၊ blur ကြီးတဲ့ အရိပ်ပျော့က မြင့်တက်မှုအဖြစ် မြင်ရတယ်။ linear-gradient က အရောင်တွေ background အဖြစ် ရောစပ်တယ် — ထောင့်နဲ့ အရောင်နေရာ ပေးပါ။" },
        ],
      },
      "css-quiz": {
        title: "CSS Quiz",
        summary: "သင့် style ဗဟုသုတ စစ်ဆေးပါ။",
      },
    },
  },
  // ───────────────────────── JavaScript ───────────────────────────────────
  javascript: {
    title: "JavaScript သင်တန်း",
    description: "variable, function, loop, DOM နဲ့ event — စာမျက်နှာတွေ တွေးတတ်အောင်လုပ်ပါ။",
    lessons: {
      "js-variables": {
        title: "Variable နဲ့ Type များ",
        summary: "let, const နဲ့ အခြေခံ value type များ။",
        sections: [
          { heading: "value သိမ်းခြင်း", body: "မပြောင်းတဲ့ value အတွက် const၊ ပြောင်းတဲ့ဟာအတွက် let သုံးပါ။ JavaScript ရဲ့ အခြေခံ type တွေမှာ number, string (quote ထဲ စာသား), boolean (true/false), array နဲ့ object ပါတယ်။ backtick နဲ့ template string က ${ } နဲ့ value ထည့်လို့ရတယ်။" },
        ],
      },
      "js-functions": {
        title: "Function များ",
        summary: "input နဲ့ output ပါတဲ့ ပြန်သုံးနိုင်တဲ့ logic block များ။",
        sections: [
          { heading: "သတ်မှတ်ခြင်းနဲ့ ခေါ်ခြင်း", body: "function တစ်ခုက parameter ယူ၊ အလုပ်လုပ်ပြီး ရလဒ်ပြန်ပေးတယ်။ arrow function က ခေတ်မီ အတိုကောက် syntax။ တစ်ခါ သတ်မှတ်ပြီးရင် ကြိုက်သလောက် ခေါ်လို့ရတယ်။" },
        ],
      },
      "js-conditions-loops": {
        title: "Condition နဲ့ Loop များ",
        summary: "if/else ဆုံးဖြတ်ချက်နဲ့ for/while ထပ်ခါလုပ်ခြင်း။",
        sections: [
          { heading: "ဆုံးဖြတ်ခြင်းနဲ့ ထပ်လုပ်ခြင်း", body: "if/else က condition မှန်မှသာ code run တယ်။ for loop က သတ်မှတ်အကြိမ်ရေ ထပ်လုပ်၊ while က condition မှန်နေသမျှ ထပ်လုပ်တယ်။ နှိုင်းယှဉ်တာက === (ညီ), !== (မညီ), < နဲ့ > သုံးတယ်။" },
        ],
      },
      "js-arrays-objects": {
        title: "Array နဲ့ Object များ",
        summary: "value စာရင်းနဲ့ label တပ် data၊ map/filter ပါ။",
        sections: [
          { heading: "စုစည်းမှုများ", body: "Array က စီထားတဲ့ စာရင်း — plants[0] က ပထမ item။ Object က label တပ် field — plant.name။ Array method တွေက အလုပ်ကြီးလုပ်တယ် — map က item တိုင်း ပြောင်း၊ filter က အချို့ ထား၊ find က ပထမ ကိုက်တာ ယူတယ်။" },
        ],
      },
      "js-dom": {
        title: "DOM",
        summary: "JavaScript ကနေ စာမျက်နှာကို ဖတ်ပြီး ပြောင်းပါ။",
        sections: [
          { heading: "စာမျက်နှာက object များအဖြစ်", body: "browser က သင့် HTML ကို DOM အဖြစ် ပြောင်းတယ် — JavaScript ဖတ်လို့ပြင်လို့ရတဲ့ object သစ်ပင်။ document.querySelector က element ရှာ၊ .textContent က စာသားပြောင်း၊ .style နဲ့ .classList က အသွင်ပြောင်း၊ document.createElement က အသစ်ထည့်တယ်။" },
        ],
      },
      "js-events": {
        title: "Event နဲ့ Mini App",
        summary: "click, input, submit — todo list လေး တစ်ခုဆောက်ပါ။",
        sections: [
          { heading: "user ကို တုံ့ပြန်ခြင်း", body: "addEventListener က တစ်ခုခုဖြစ်ရင် သင့် function run တယ် — click, ရိုက်တာ, form submit။ ဒီသင်ခန်းစာက အရင်အားလုံးကို ပေါင်းပြီး အလုပ်လုပ်တဲ့ todo list ဆောက်တယ် — web app တိုင်းရဲ့ ပုံစံပါ။" },
        ],
      },
      "js-strings-numbers": {
        title: "String နဲ့ Number များ",
        summary: "အမြဲသုံးတဲ့ method များ။",
        sections: [
          { heading: "String ကိရိယာတန်ဆာ", body: "toUpperCase/toLowerCase က စာလုံးအကြီးအသေးပြောင်း၊ includes က substring ရှိမရှိစစ်၊ split က စာသားကို array ပြောင်း၊ trim က ဘေးက space ဖယ်၊ slice က အပိုင်းဖြတ်။ Number တွေက ဒသမအတွက် toFixed နဲ့ Math.round, floor, random စတဲ့ helper ရတယ်။" },
        ],
      },
      "js-json": {
        title: "JSON",
        summary: "web ရဲ့ data format — stringify နဲ့ parse။",
        sections: [
          { heading: "object ⇄ စာသား", body: "API တွေက data ကို JSON စာသားအဖြစ် ပို့တယ်။ JSON.stringify က JavaScript object ကို အဲဒီစာသား ပြောင်း၊ JSON.parse က ပြန်ပြောင်းတယ်။ server နဲ့ ဆက်သွယ်တဲ့ app တိုင်း ဒါကို အမြဲလုပ်တယ်။" },
        ],
      },
      "js-timers": {
        title: "Timer နဲ့ Animation",
        summary: "setTimeout, setInterval နဲ့ တိုက်ရိုက်နာရီ။",
        sections: [
          { heading: "နောက်မှ — ဒါမှမဟုတ် ထပ်ခါ လုပ်ခြင်း", body: "setTimeout(fn, ms) က ကြာချိန်ပြီးမှ တစ်ခါ run၊ setInterval(fn, ms) က ထပ်ခါထပ်ခါ run တယ်။ နာရီ၊ countdown နဲ့ ရိုးရှင်း animation တွေကို လုပ်ပေးတယ်။ ပြီးရင် clearInterval လုပ်နိုင်အောင် id ကို အမြဲသိမ်းပါ။" },
        ],
      },
      "js-quiz": {
        title: "JavaScript Quiz",
        summary: "JavaScript သင်တန်းတစ်ခုလုံး စစ်ဆေးပါ။",
      },
    },
  },
  // ─────────────────────────── Python ─────────────────────────────────────
  python: {
    title: "Python သင်တန်း",
    description: "အဖော်ရွယ်ဆုံး programming language — data, logic နဲ့ automation။",
    lessons: {
      "py-intro": {
        title: "Python မိတ်ဆက်",
        summary: "Python ဆိုတာဘာလဲ၊ print၊ ပထမဆုံး လိုင်းများ run ခြင်း။",
        sections: [
          { heading: "Python ဘာလို့လဲ", body: "Python က အင်္ဂလိပ်လို ဖတ်လို့ရလုနီးပါးမို့ ပထမဆုံး language အဖြစ် လူသုံးအများဆုံး — AI, data science, website နဲ့ automation တွေကို လုပ်ပေးတယ်။ python.org မှာ အခမဲ့ run လို့ရတယ်။" },
          { heading: "print() — ပထမဆုံး function", body: "print() က မျက်နှာပြင်မှာ စာသားရေးတယ်။ စာသား (string) က quote ထဲ ထည့်၊ ဂဏန်းက quote မလို။ တစ်လိုင်းက program အပြည့်အစုံ။" },
          { heading: "Comment", body: "# နဲ့ စတဲ့ လိုင်းတွေက comment — လူတွေအတွက် မှတ်စု၊ Python က လျစ်လျူရှုတယ်။" },
        ],
      },
      "py-variables": {
        title: "Variable နဲ့ Type များ",
        summary: "number, string, boolean နဲ့ f-string။",
        sections: [
          { heading: "ကြေညာစရာ မလို", body: "variable ကို တန်ဖိုးပေးလိုက်တာနဲ့ ဖန်တီးပြီးသား။ Python က type ကို သိတယ် — int (ဂဏန်းပြည့်), float (ဒသမ), str (စာသား), bool (True/False)။" },
          { heading: "f-string", body: "quote ရှေ့မှာ f ထည့်ပြီး curly brace နဲ့ value ထည့်ပါ — စာသားဆောက်ဖို့ အသန့်ရှင်းဆုံးနည်း။" },
          { heading: "type ပြောင်းခြင်း", body: "int(), float() နဲ့ str() က type တွေ ပြောင်းတယ် — အမြဲ စာသားအဖြစ်ရောက်တဲ့ user input ဖတ်တဲ့အခါ မရှိမဖြစ်။" },
        ],
      },
      "py-conditions": {
        title: "If / Elif / Else",
        summary: "indentation နဲ့ ဆုံးဖြတ်ချက် — Python ရဲ့ လက္ခဏာ။",
        sections: [
          { heading: "Indentation က syntax", body: "Python က curly brace အစား indentation နဲ့ code စုတယ်။ if အောက်က indent လုပ်ထားတာ အားလုံး condition မှန်မှသာ run တယ်။ elif က ထပ်စစ်၊ else က ကျန်တာ ဖမ်းတယ်။" },
          { heading: "condition ပေါင်းစပ်ခြင်း", body: "and, or နဲ့ not က စစ်ချက်တွေ ပေါင်းတယ် — သင်္ကေတထက် ဖတ်ရ ပိုလွယ်တယ်။" },
        ],
      },
      "py-loops": {
        title: "Loop များ",
        summary: "for, while, range() နဲ့ list ပတ်ခြင်း။",
        sections: [
          { heading: "for + range", body: "range(1, 8) က 1 ကနေ 7 အထိ ရေတွက် (အဆုံး ချန်တယ်)။ loop body က ဂဏန်းတစ်ခုစီအတွက် တစ်ခါ run တယ်။" },
          { heading: "list ပတ်ခြင်း", body: "for က list ပေါ်မှာ တိုက်ရိုက် အလုပ်လုပ်တယ် — index စီမံစရာ မလိုဘူး။" },
          { heading: "while", body: "while က condition မှန်နေသမျှ ထပ်လုပ်တယ် — အထဲက တစ်ခုခု ပြောင်းအောင် သေချာပါ၊ မဟုတ်ရင် အဆုံးမရှိ ပတ်နေမယ်။" },
        ],
      },
      "py-functions": {
        title: "Function များ",
        summary: "def, parameter, return နဲ့ default value။",
        sections: [
          { heading: "def က သတ်မှတ်၊ return က ဖြေ", body: "function တွေက ပြန်သုံးချင်တဲ့ logic ကို စုတယ်။ parameter က ကွင်းထဲ၊ return က ရလဒ်ကို ခေါ်သူဆီ ပြန်ပို့တယ်။" },
          { heading: "default value", body: "parameter မှာ default ရှိနိုင်တာမို့ ခေါ်သူ ကျော်လို့ရတယ်။" },
        ],
      },
      "py-collections": {
        title: "List နဲ့ Dictionary",
        summary: "Python ရဲ့ အဓိက container နှစ်ခု။",
        sections: [
          { heading: "List", body: "list က စီထားတဲ့ စုစည်းမှု။ 0 ကနေ index၊ append နဲ့ ထည့်၊ len() နဲ့ ရေတွက်။" },
          { heading: "Dictionary", body: "dict က key တွေကို value နဲ့ တွဲတယ် — label တပ် မှတ်တမ်းလို။" },
          { heading: "Mini program", body: "အားလုံးပေါင်း — အာဟာရလိုနေတဲ့ အပင်တွေ ရှာခြင်း။" },
        ],
      },
      "py-strings": {
        title: "String ကိုင်တွယ်ခြင်း",
        summary: "slice, method နဲ့ စာသားပေါင်းခြင်း။",
        sections: [
          { heading: "Slicing", body: "square bracket က string ထဲက စာလုံးဆွဲထုတ်တယ် — [0] က ပထမ၊ [-1] က နောက်ဆုံး၊ [0:4] က ပထမလေးလုံး။" },
          { heading: "အမြဲသုံး method", body: "upper/lower က စာလုံးပြောင်း၊ strip က space ဖယ်၊ replace က စာသားလဲ၊ split က string ကို list ပြောင်း၊ join က list ကို ပြန်ပေါင်းတယ်။" },
        ],
      },
      "py-errors": {
        title: "Error နဲ့ try/except",
        summary: "crash မဖြစ်ဘဲ ပြဿနာ ကိုင်တွယ်ပါ။",
        sections: [
          { heading: "exception ဖမ်းခြင်း", body: "တစ်ခုခု မှားရင် Python က exception ထုတ်တယ်။ အန္တရာယ်ရှိတဲ့ code ကို try ထဲ ထုပ်ပြီး except မှာ ကိုင်ပါ — user က ဂဏန်းနေရာမှာ စာသားရိုက်တာမျိုး။" },
          { heading: "finally", body: "finally block က error ဖြစ်ဖြစ် မဖြစ်ဖြစ် အမြဲ run တယ် — file ပိတ်တာမျိုး cleanup နေရာ။" },
        ],
      },
      "py-modules": {
        title: "Module: math, random နဲ့ datetime",
        summary: "standard library က အသင့်သုံး ကိရိယာများ import လုပ်ပါ။",
        sections: [
          { heading: "import", body: "Python မှာ module ရာနဲ့ချီ ပါတယ်။ import က တစ်ခုကို ယူ၊ ပြီးရင် dot နဲ့ function ထဲဝင်ပါ။" },
          { heading: "ရက်စွဲနဲ့ အချိန်", body: "datetime က နာရီနဲ့ ပြက္ခဒိန် ကိုင်တယ် — log နဲ့ အချိန်ဇယားရဲ့ ကျောရိုးပါ။" },
        ],
      },
      "py-quiz": {
        title: "Python Quiz",
        summary: "Python သင်တန်းတစ်ခုလုံး စစ်ဆေးပါ။",
      },
    },
  },

  // ─────────────────────────── SQL course ─────────────────────────────────
  sql: {
    title: "SQL: Database နဲ့ ပြောဆိုခြင်း",
    description:
      "Browser ထဲမှာ တကယ့် data ကို query လုပ်ပါ — SELECT, WHERE, JOIN စသည်။ install စရာမလို။",
    lessons: {
      "sql-intro": {
        title: "SQL ဆိုတာ ဘာလဲ?",
        summary: "Database, table, row နဲ့ column — data ရဲ့ ဘာသာစကား။",
        sections: [
          {
            heading: "Database က စနစ်တကျ စီထားတဲ့ အချက်အလက်",
            body: "Database က program တစ်ခု အချက်အလက်ကို မြန်မြန် ပြန်ရှာနိုင်အောင် သိမ်းပေးတယ်။ သင်သုံးတဲ့ app တိုင်းလိုလို — ဆိုင်၊ chat၊ GreenWave ကိုယ်တိုင် — data ကို database ထဲ သိမ်းတယ်။ SQL (Structured Query Language) က database ကို မေးခွန်းမေးဖို့နဲ့ ပြင်ဖို့ သုံးတဲ့ ဘာသာစကားပါ။",
          },
          {
            heading: "Table, row နဲ့ column",
            body: "Data က table တွေထဲ နေတယ် — Excel ဇယားနဲ့ တူတယ်။ table တိုင်းမှာ column (name, city စတဲ့ field) နဲ့ row (grower တစ်ယောက်ချင်း စာရင်း) ရှိတယ်။ ဒီသင်ခန်းစာတွေမှာ table နှစ်ခု — growers နဲ့ strains — ကို query လုပ်မှာပါ။",
          },
          {
            heading: "Query က မေးခွန်းမေးခြင်း",
            body: "Query ဆိုတာ data တောင်းဆိုမှုပါ။ အသုံးအများဆုံး query က SELECT နဲ့ စတယ် — 'ဒီ column တွေကို ဒီ table ကနေ ရွေးပါ'။ သင်ခန်းစာတိုင်းမှာ live editor ရှိတယ် — query ကို ပြင်ပြီး Run နှိပ်ရင် တကယ့်ရလဒ် မြင်ရမယ်။",
          },
        ],
      },
      "sql-select": {
        title: "SELECT: Data ဖတ်ခြင်း",
        summary: "SELECT နဲ့ table ထဲက column တွေ ဆွဲထုတ်ပါ။",
        sections: [
          {
            heading: "SELECT column FROM table",
            body: "SELECT က လိုချင်တဲ့ column တွေကို ပြော၊ FROM က table ကို ပြောတယ်။ `*` က 'column အားလုံး' လို့ အဓိပ္ပာယ်ရတယ်။ SQL keyword တွေ စာလုံးအကြီးအသေး ကွာမှုမရှိပေမဲ့ စာလုံးကြီးရေးတာက ဖတ်ရလွယ်စေတယ်။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "အောက်က query ကို Run လုပ်ပြီး grower အားလုံး ကြည့်ပါ။ ပြီးရင် `SELECT name, plants FROM growers;` လို့ ပြောင်းပြီး column နှစ်ခုပဲ ပြန်ကြည့်ပါ။",
          },
        ],
      },
      "sql-where": {
        title: "WHERE: Row စစ်ထုတ်ခြင်း",
        summary: "အခြေအနေတစ်ခုနဲ့ ကိုက်တဲ့ row တွေပဲ ထားပါ။",
        sections: [
          {
            heading: "WHERE နဲ့ စစ်ထုတ်ခြင်း",
            body: "WHERE က အခြေအနေ မှန်တဲ့ row တွေပဲ ထားတယ်။ `=`, `<`, `>`, `<=`, `>=` နဲ့ `<>` (မညီ) တို့နဲ့ နှိုင်းယှဉ်နိုင်တယ်။ စာသားတန်ဖိုးကို single quote ထဲ ထည့်၊ ဂဏန်းက မထည့်ရ။ အခြေအနေတွေကို AND နဲ့ OR နဲ့ ပေါင်းပါ။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "အပင် ၁၀ ပင်ထက် များတဲ့ grower ရှာဖို့ query ကို Run ပါ။ ပြီးရင် ဂဏန်းကို ပြောင်း၊ ဒါမှမဟုတ် city name ထည့်ပြီး ပြန် run ပါ။",
          },
        ],
      },
      "sql-order-limit": {
        title: "ORDER BY နဲ့ LIMIT",
        summary: "ရလဒ်ကို စီပြီး ထိပ်ဆုံး အနည်းငယ်ပဲ ယူပါ။",
        sections: [
          {
            heading: "Row များ စီခြင်း",
            body: "ORDER BY က ရလဒ်ကို column တစ်ခုနဲ့ စီတယ်။ DESC က များစွာမှ နည်းစွာ (ဆင်းသက်)၊ ASC က နည်းမှ များ (default)။ LIMIT က ရလဒ်ကို row အရေအတွက် တစ်ခုအထိ ဖြတ်တယ် — 'ထိပ်ဆုံး ၃' မေးခွန်းမျိုးအတွက် အသုံးဝင်တယ်။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "Query က grower တွေကို အပင်များစွာမှ နည်းစွာ စီပြထားတယ်။ အဆုံးမှာ `LIMIT 3` ထည့်ပြီး ထိပ်ဆုံး grower ၃ ယောက်ပဲ ကြည့်ပါ။",
          },
        ],
      },
      "sql-distinct": {
        title: "DISTINCT: တူညီမှုမရှိတဲ့ တန်ဖိုးများ",
        summary: "column တစ်ခုက ထပ်နေတဲ့ တန်ဖိုးတွေ ဖယ်ပါ။",
        sections: [
          {
            heading: "မထပ်တဲ့ တန်ဖိုးများပဲ",
            body: "SELECT DISTINCT က တန်ဖိုးတစ်ခုစီကို တစ်ကြိမ်ပဲ ပြန်ပေးတယ်။ grower အများကြီး Yangon မှာ နေပေမဲ့ `SELECT DISTINCT city` က မြို့တစ်ခုစီကို တစ်ကြိမ်ပဲ စာရင်းပြတယ် — menu ဆောက်တာ ဒါမှမဟုတ် ဘယ်တန်ဖိုးတွေ ရှိလဲ ကြည့်ဖို့ အသုံးဝင်တယ်။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "မြို့ distinct စာရင်း ကြည့်ဖို့ Run ပါ။ ပြီးရင် DISTINCT ကို ဖယ်ပြီး ပြန် run ရင် ထပ်နေတာတွေ ပြန်ပေါ်တာ သတိထားပါ။",
          },
        ],
      },
      "sql-aggregate": {
        title: "COUNT, SUM နဲ့ AVG",
        summary: "row အများကြီးကို အဖြေတစ်ခုတည်း ဖြစ်အောင် ပြောင်းပါ။",
        sections: [
          {
            heading: "Aggregate function များ",
            body: "Aggregate function တွေက row အများကို တန်ဖိုးတစ်ခု ဖြစ်အောင် ချုပ်တယ်။ COUNT(*) က row ရေတွက်၊ SUM က column ပေါင်း၊ AVG က ပျမ်းမျှ၊ MIN/MAX က အသေးဆုံးနဲ့ အကြီးဆုံး ပေးတယ်။ ရလဒ် column ကို AS နဲ့ အမည်ပြောင်းနိုင်တယ်။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "Query က grower တိုင်းရဲ့ အပင်တွေ ပေါင်းတယ်။ SUM ကို AVG ဒါမှမဟုတ် MAX လို့ ပြောင်းပြီး ပြန် run ရင် data တစ်ခုတည်းကို မေးခွန်းအသစ် မေးလို့ရတယ်။",
          },
        ],
      },
      "sql-group-by": {
        title: "GROUP BY နဲ့ HAVING",
        summary: "အမျိုးအစားအလိုက် data ချုပ်ပါ။",
        sections: [
          {
            heading: "အုပ်စုတစ်ခုစီ အနှစ်ချုပ်တစ်ခု",
            body: "GROUP BY က တန်ဖိုးတူတဲ့ row တွေကို အုပ်စုဖွဲ့ပြီး အုပ်စုတစ်ခုစီမှာ aggregate run တယ်။ 'မြို့တစ်ခုစီ အပင်ဘယ်လောက်?' ဆိုတာ city နဲ့ group ပြီး plants ပေါင်းတာ။ HAVING က group လုပ်ပြီး ရလဒ်ကို စစ်တယ် (WHERE က group မလုပ်ခင် row စစ်၊ HAVING က group လုပ်ပြီး စစ်)။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "Query က မြို့တစ်ခုစီအတွက် အပင် ပေါင်းတယ်။ အဆုံးမှာ ORDER BY plants DESC ထည့်ပြီး မြို့တွေ အဆင့်သတ်မှတ်ပြီး run ပါ။",
          },
        ],
      },
      "sql-join": {
        title: "JOIN: Table များ ပေါင်းစပ်ခြင်း",
        summary: "table နှစ်ခုက row တွေ ကိုက်ညှိပြီး ပိုနက်နဲတဲ့ မေးခွန်း ဖြေပါ။",
        sections: [
          {
            heading: "Key နဲ့ table ချိတ်ခြင်း",
            body: "တကယ့် database တွေက data ကို table အများမှာ ခွဲထားပြီး key နဲ့ ချိတ်တယ်။ strain တစ်ခုစီမှာ grower ရဲ့ `id` ကို ညွှန်တဲ့ `grower_id` ရှိတယ်။ JOIN က အဲ့ row တွေ ကိုက်ညှိပေးတာမို့ ရလဒ်တစ်ခုတည်းမှာ strain ဘေးမှာ grower name မြင်ရတယ်။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "Query က strain တစ်ခုစီကို စိုက်တဲ့ grower နဲ့ ပြတယ်။ semicolon မတိုင်ခင် `WHERE growers.city = 'Yangon'` ထည့်ပြီး Yangon grower တွေရဲ့ strain ပဲ ကြည့်ပါ။",
          },
        ],
      },
      "sql-insert-update": {
        title: "INSERT, UPDATE နဲ့ DELETE",
        summary: "data ဖတ်ရုံမက ပြင်လည်း ပြင်ပါ။",
        sections: [
          {
            heading: "Data ရေးသားခြင်း",
            body: "SELECT က ဖတ်တယ်၊ INSERT/UPDATE/DELETE က data ပြင်တယ်။ INSERT က row အသစ်ထည့်၊ UPDATE က ရှိပြီးသား row ပြင် (WHERE အမြဲပါစေ၊ မဟုတ်ရင် row အားလုံး ပြောင်းသွားမယ်!)၊ DELETE က row ဖျက်တယ်။ ဒီမှာ Run လုပ်တိုင်း database အသစ် ပြန်ဆောက်တာမို့ လွတ်လွတ်လပ်လပ် စမ်းပါ။",
          },
          {
            heading: "လုပ်ကြည့်ပါ",
            body: "Query က grower အသစ်ထည့်ပြီး အားလုံးကို ပြန်ရွေးပြတယ် — အပြောင်းအလဲ မြင်ရအောင်။ နောက်ဆုံး SELECT မတိုင်ခင် UPDATE line တစ်ခု ထည့်ကြည့်ပါ။",
          },
        ],
      },
      "sql-quiz": {
        title: "SQL Quiz",
        summary: "Database query လုပ်နည်း သင်ယူထားတာ စစ်ဆေးပါ။",
        quiz: [
          {
            q: "Table ကနေ data ဖတ်တဲ့ keyword က ဘယ်ဟာလဲ?",
            options: ["READ", "SELECT", "GET", "SHOW"],
            explain: "SELECT က column ရွေး၊ FROM က table ပြောတယ်။",
          },
          {
            q: "အခြေအနေနဲ့ ကိုက်တဲ့ row တွေပဲ ထားတဲ့ clause က ဘယ်ဟာလဲ?",
            options: ["ORDER BY", "GROUP BY", "WHERE", "LIMIT"],
          },
          {
            q: "COUNT(*) က ဘာ ပြန်ပေးလဲ?",
            options: ["အကြီးဆုံး တန်ဖိုး", "row အရေအတွက်", "ပျမ်းမျှ", "column နာမည်များ"],
          },
          {
            q: "JOIN က ဘာလုပ်လဲ?",
            options: [
              "ထပ်နေတဲ့ row ဖျက်တယ်",
              "ရလဒ် စီတယ်",
              "key နဲ့ table နှစ်ခုက row ကိုက်ညှိတယ်",
              "column အသစ် အမြဲထည့်တယ်",
            ],
            explain: "JOIN က grower_id = id လို key နဲ့ table ချိတ်တယ်။",
          },
          {
            q: "ဘယ် statement မှာ WHERE clause အမြဲပါသင့်လဲ?",
            options: ["SELECT", "UPDATE", "CREATE TABLE", "ဘယ်တော့မှ အရေးမကြီး"],
            explain: "WHERE မပါရင် UPDATE နဲ့ DELETE က row အားလုံးကို ထိတယ်။",
          },
        ],
      },
    },
  },

  // ─────────────────────────── AI course ──────────────────────────────────
  ai: {
    title: "Artificial Intelligence အခြေခံများ",
    description:
      "စက်တွေ ဘယ်လို သင်ယူလဲ၊ neural network နဲ့ generative AI ဆိုတာ ဘာလဲ၊ AI ကို တာဝန်သိသိ ဘယ်လိုသုံးမလဲ။",
    lessons: {
      "ai-intro": {
        title: "Artificial Intelligence ဆိုတာ ဘာလဲ?",
        summary: "တွေးခေါ်မှု လိုအပ်သလို ထင်ရတဲ့ အလုပ်တွေ လုပ်နိုင်တဲ့ စက်များ အကြောင်း။",
        sections: [
          {
            heading: "အလုပ်လုပ်တဲ့ အဓိပ္ပာယ်",
            body: "Artificial intelligence (AI) က လူ့တွေးခေါ်မှုနဲ့ ဆက်စပ်တဲ့ အလုပ်တွေ — ဓာတ်ပုံမှတ်မိ၊ စာကြောင်းနားလည်၊ strain အကြံပြု၊ သီးနှံ ဘယ်တော့ ရင့်မလဲ ခန့်မှန်း — လုပ်တဲ့ software ပါ။ AI က လူလို 'မတွေး' ဘူး၊ data ထဲက ပုံစံတွေ ရှာပြီး အသုံးဝင်တဲ့ ခန့်မှန်းချက် လုပ်တာပါ။",
          },
          {
            heading: "Narrow AI က နေရာတိုင်းမှာ",
            body: "ယနေ့ AI အားလုံးနီးပါးက 'narrow' — အလုပ်တစ်ခုမှာ တော်တော်ကောင်းပြီး တခြားမှာ အသုံးမဝင်။ email spam filter၊ traffic ခန့်မှန်းတဲ့ map၊ ဖုန်းက voice assistant တွေက narrow AI တွေ။ လူလုပ်နိုင်တာ အားလုံးလုပ်နိုင်တဲ့ 'general' AI က မရှိသေးပါ။",
          },
          {
            heading: "Rule vs. သင်ယူခြင်း",
            body: "စောစောပိုင်း AI က လူရေးထားတဲ့ rule လိုက်တယ်: IF humidity ၇၀% ကျော် THEN pan ဖွင့်။ ဒါ အခုထိ ကောင်းကောင်း အလုပ်လုပ်ပြီး နားလည်ရလွယ်တယ်။ ခေတ်သစ် AI က machine learning ထည့်တယ် — ဥပမာ အများကြီး လေ့လာပြီး rule ကို ကိုယ်တိုင် ရှာတယ် — နောက်သင်ခန်းစာမှာ။",
          },
        ],
      },
      "ai-machine-learning": {
        title: "Machine Learning",
        summary: "rule မပြောဘဲ ဥပမာတွေကနေ software က ပုံစံ သင်ယူပုံ။",
        sections: [
          {
            heading: "ဥပမာကနေ သင်ယူခြင်း",
            body: "Machine learning (ML) က AI ရဲ့ အပိုင်းတစ်ခုဖြစ်ပြီး လူရေးထားတဲ့ rule မဟုတ်ဘဲ data လေ့လာပြီး program တိုးတက်လာတယ်။ 'ကျန်းမာ' / 'ရောဂါရ' လို့ label တပ်ထားတဲ့ အရွက်ဓာတ်ပုံ ထောင်ချီ ပြရင် နှစ်ခု ခွဲတဲ့ ပုံစံ သင်ယူပြီး မမြင်ဖူးတဲ့ ဓာတ်ပုံအသစ်ကို ဆုံးဖြတ်နိုင်တယ်။",
          },
          {
            heading: "ပုံစံ သုံးမျိုး",
            body: "Supervised learning မှာ ဥပမာတွေမှာ အဖြေမှန် (label) ပါတယ်။ Unsupervised learning မှာ label မရှိဘဲ တူတာတွေ ကိုယ်တိုင် အုပ်စုဖွဲ့တယ်။ Reinforcement learning မှာ agent က စမ်းသပ်ရင်း၊ လုပ်ကောင်းရင် reward ရရင်း သင်ယူတယ် — game ကစားတဲ့ AI လိုမျိုး။",
          },
          {
            heading: "Feature နဲ့ ခန့်မှန်းချက်",
            body: "Model က feature — အပူ၊ စိုထိုင်းဆ၊ စိုက်ပြီး ဘယ်နှရက် စတဲ့ တိုင်းတာနိုင်တဲ့ input — ကို ကြည့်ပြီး 'ရက် ၆ ရက်အတွင်း ရိတ်လို့ရ' လို ခန့်မှန်းချက် ထုတ်တယ်။ model ကောင်းတာထက် feature သင့်တော်တာက ပိုအရေးကြီးလေ့ရှိတယ်။",
          },
        ],
      },
      "ai-neural-networks": {
        title: "Neural Network နဲ့ Deep Learning",
        summary: "ဓာတ်ပုံနဲ့ ဘာသာစကား AI နောက်ကွယ်က အလွှာဆင့် model များ။",
        sections: [
          {
            heading: "ဦးနှောက်ကနေ ရသော အကြံ",
            body: "Neural network က 'neuron' လို့ ခေါ်တဲ့ ရိုးရှင်းတဲ့ unit အများကို အလွှာလိုက် ချိတ်ထားတဲ့ model ပါ။ ချိတ်ဆက်မှုတိုင်းမှာ weight — signal ကို အားဖြည့် ဒါမှမဟုတ် လျှော့တဲ့ ဂဏန်း — ရှိတယ်။ data တစ်ဘက်ဝင်၊ အလွှာတွေ ဖြတ်ပြီး တစ်ဘက်က အဖြေထွက်တယ်။ weight တွေ ညှိရင်း ပိုမှန်လာအောင် သင်ယူတယ်။",
          },
          {
            heading: "'Deep' ဘာကြောင့်",
            body: "Deep learning ဆိုတာ အလွှာများတဲ့ neural network ပဲ။ ရှေ့အလွှာတွေက ရိုးရှင်းတဲ့ ပုံစံ (ဓာတ်ပုံထဲ အနား) ဖမ်း၊ နောက်အလွှာတွေက ပေါင်းစပ်ပြီး ရှုပ်ထွေးတဲ့ အယူအဆ (အရွက်၊ ပြီးရင် ရောဂါရ အရွက်) ဖြစ်လာတယ်။ အလွှာ ထပ်ခြင်းက ဓာတ်ပုံ၊ အသံ၊ စာသား စတဲ့ ရှုပ်တဲ့ data ကို ကိုင်နိုင်စေတယ်။",
          },
          {
            heading: "Training မှာ data နဲ့ ကွန်ပျူတာ အား လိုတယ်",
            body: "Network တွေက ခန့်မှန်း၊ ဘယ်လောက်မှားလဲ တိုင်း (loss)၊ error လျှော့ဖို့ weight ညှိ — သန်းနဲ့ချီ ထပ်ကာ သင်ယူတယ်။ ဒါက data အများနဲ့ စွမ်းအားကြီး hardware လိုတာမို့ AI model ကြီးတွေ ဆောက်ရ စျေးကြီးတယ်။",
          },
        ],
      },
      "ai-training-data": {
        title: "Data: AI ရဲ့ လောင်စာ",
        summary: "data အရည်အသွေးက AI အရည်အသွေးကို ဆုံးဖြတ်ပုံ။",
        sections: [
          {
            heading: "အမှိုက်ဝင်ရင် အမှိုက်ထွက်",
            body: "AI model က သင်ယူတဲ့ data လောက်ပဲ ကောင်းတယ်။ ဥပမာတွေ မှား၊ ပျောက်၊ ဒါမှမဟုတ် ကိုယ်စားမပြုရင် ခန့်မှန်းချက်တွေလည်း မှားမယ်။ data ကို ဂရုတစိုက် စုပြီး သန့်စင်တာက တကယ့် AI project ရဲ့ အကြီးဆုံး အပိုင်း ဖြစ်လေ့ရှိတယ်။",
          },
          {
            heading: "Training, validation နဲ့ test",
            body: "Data ကို အပိုင်း ၃ ပိုင်း ခွဲလေ့ရှိတယ်: model သင်ယူတဲ့ training set၊ ညှိဖို့ validation set၊ မမြင်ဖူးတဲ့ data ပေါ် ရိုးသားစွာ စစ်ဖို့ ဘေးဖယ်ထားတဲ့ test set။ model ကို သင်ယူထားတဲ့ data ပေါ်ပဲ စစ်ရင် မမျှတဘဲ ချီးမွမ်းမိမယ်။",
          },
          {
            heading: "Bias က data ထဲ ပုန်းနေတယ်",
            body: "Dataset မှာ ရာသီဥတု တစ်မျိုးက အပင်ပဲ ပါရင် model က တခြားနေရာမှာ ကျရှုံးနိုင်တယ်။ data ထဲက bias က ခန့်မှန်းချက်ထဲ bias ဖြစ်လာတယ်။ team ကောင်းတွေက သူတို့ data က ဘယ်သူ ကိုယ်စားပြု၊ ဘယ်သူ ကျန်ခဲ့လဲ ယုံမီ စစ်တယ်။",
          },
        ],
      },
      "ai-generative": {
        title: "Generative AI နဲ့ Large Language Model",
        summary: "စာရေး၊ ပုံဆွဲ၊ code ရေးတဲ့ AI — ဘယ်လို အလုပ်လုပ်လဲ။",
        sections: [
          {
            heading: "အကြောင်းအရာ အသစ် ဖန်တီးခြင်း",
            body: "Generative AI က ရှိပြီးသား data ကို ခွဲခြား/label တပ်ရုံမက အကြောင်းအရာအသစ် — စာသား၊ ပုံ၊ အသံ၊ code — ဖန်တီးတယ်။ chat assistant၊ ပုံဖန်တီးတာ၊ coding helper တွေက generative အားလုံးပါ။",
          },
          {
            heading: "Language model ဘယ်လို ခန့်မှန်းလဲ",
            body: "Large language model (LLM) က စာသား အများကြီးနဲ့ သင်ယူပြီး နောက်စကားလုံးကို ထပ်ကာထပ်ကာ ခန့်မှန်းတယ်။ အဲ့ ရိုးရှင်းတဲ့ ရည်ရွယ်ချက်ကနေ သဒ္ဒါ၊ အချက်အလက်၊ ကျိုးကြောင်းဆက်စပ်မှု ပုံစံတွေ ရလာတယ်။ prompt ရိုက်ရင် အပိုင်းလိုက် အဖြေ ဖန်တီးတယ်။",
          },
          {
            heading: "ယုံကြည်စွာ ပြောပေမဲ့ တခါတရံ မှား",
            body: "Model က အမှန်တရား မရှာဘဲ ဖြစ်နိုင်ခြေရှိတဲ့ စာသား ခန့်မှန်းတာမို့ မှားတဲ့ အချက်ကို ချောချောမွေ့မွေ့ ပြောနိုင်တယ် — ဒါကို 'hallucination' လို့ ခေါ်တယ်။ generative AI ကို အမြဲ စစ်ရမဲ့ မြန်ဆန်တဲ့ မူကြမ်း ရေးသူ အဖြစ် သဘောထားပါ၊ ဘုရားစကား မဟုတ်ပါ။",
          },
        ],
      },
      "ai-using-ai": {
        title: "AI ကို ကောင်းကောင်း သုံးခြင်း: Prompting",
        summary: "AI tool ကနေ ပိုကောင်းတဲ့ ရလဒ် ရဖို့ လက်တွေ့နည်းများ။",
        sections: [
          {
            heading: "Prompt က သင့် ညွှန်ကြားချက်",
            body: "Prompt ဆိုတာ AI tool ကို လုပ်ခိုင်းတဲ့ အရာ။ ရှင်းပြီး တိကျတဲ့ prompt က ပိုကောင်းတဲ့ အဖြေ ရတယ်။ ဘယ်သူအဖြစ် လုပ်ရမလဲ၊ ဘာလိုချင်လဲ၊ ဘယ်ပုံစံ လိုချင်လဲ ပြောပါ: 'မင်း စိုက်ပျိုးရေး assistant ပါ။ အရွက် ဝါလာရတဲ့ အကြောင်း ၃ ချက်ကို bullet point တိုတိုနဲ့ ပြပါ။'",
          },
          {
            heading: "Context နဲ့ ဥပမာ ပေးပါ",
            body: "Model တွေက လိုအပ်တဲ့ အချက်အလက်နဲ့ ဖြစ်နိုင်ရင် လိုချင်တဲ့ output ဥပမာ ထည့်ပေးရင် ပိုကောင်းတယ်။ တောင်းဆိုချက်ကြီးကို အဆင့်ခွဲပါ။ ပထမအဖြေ လွဲရင် အသစ်ကနေ မစဘဲ prompt ကို ပြင်ပါ — ဒီ အပြန်အလှန်က ပုံမှန်ပါ။",
          },
          {
            heading: "လူ တစ်ယောက် အမြဲ ပါဝင်စေပါ",
            body: "အရေးကြီးတဲ့ AI output — အထူးသဖြင့် ကျန်းမာရေး၊ ငွေ၊ ဘေးကင်းရေး — ကို လုပ်ဆောင်မီ စစ်ပါ။ ကိုယ်မထိန်းချုပ်နိုင်တဲ့ tool ထဲ လျှို့ဝှက်ချက် ဒါမှမဟုတ် ကိုယ်ရေးကိုယ်တာ data မထည့်ပါနဲ့။ AI က အကူ၊ နောက်ဆုံး ဆုံးဖြတ်ချက်အတွက် သင် တာဝန်ရှိတယ်။",
          },
        ],
      },
      "ai-ethics": {
        title: "AI ကျင့်ဝတ်နဲ့ ဘေးကင်းရေး",
        summary: "မျှတမှု၊ privacy နဲ့ လူ ထိန်းချုပ်ခြင်း။",
        sections: [
          {
            heading: "မျှတမှု",
            body: "AI က သူ့ data ထဲက မမျှတတဲ့ ပုံစံတွေ ထပ်တလဲလဲ လုပ်၊ ပိုတောင် ဆိုးလာစေနိုင်တယ် — ဥပမာ အုပ်စုတစ်ခုကို ကိုယ်စားနည်းလို့ ပိုဆိုးဆိုး ဆက်ဆံတာ။ မျှတတဲ့ AI ဆောက်ဖို့ overall တိကျမှုပဲ မလိုက်ဘဲ အုပ်စုအမျိုးမျိုးအလိုက် ရလဒ်တွေ စစ်ရမယ်။",
          },
          {
            heading: "Privacy နဲ့ ပွင့်လင်းမြင်သာမှု",
            body: "AI က ကိုယ်ရေးကိုယ်တာ data နဲ့ သင်ယူလေ့ရှိတာမို့ consent ကို လေးစားပြီး သိမ်းထားတာ ကာကွယ်ရမယ်။ လူတွေ AI နဲ့ ဆက်ဆံနေမှန်း၊ အရေးကြီးတဲ့ ဆုံးဖြတ်ချက်တွေမှာ ဘယ်လို ရလဒ်ရလဲ သိပိုင်ခွင့် ရှိတယ်။ ပုန်းလျှိုး ရှင်းမပြနိုင်တဲ့ ဆုံးဖြတ်ချက်က ယုံကြည်မှု ပျက်စေတယ်။",
          },
          {
            heading: "လူ တာဝန်ခံ ဆဲဆဲ",
            body: "လူ့ဘဝ ထိခိုက်တဲ့ ဆုံးဖြတ်ချက်တွေမှာ လူတစ်ယောက်က ပြန်စစ်၊ ပယ်ဖျက်၊ တာဝန်ခံနိုင်ရမယ်။ အန္တရာယ်အကင်းဆုံး စနစ်တွေက AI ကို လူ့ဆုံးဖြတ်ချက်ကို အထောက်အကူပြု၊ မြန်စေဖို့ သုံးတယ်၊ တာဝန်ကို အစားထိုးဖို့ မဟုတ်ဘူး။",
          },
        ],
      },
      "ai-quiz": {
        title: "AI Quiz",
        summary: "AI ဘယ်လို အလုပ်လုပ်လဲ၊ ဘယ်လို သုံးမလဲ သင်ယူထားတာ စစ်ဆေးပါ။",
        quiz: [
          {
            q: "ယနေ့ သုံးနေတဲ့ AI အများစုကို ဘယ်လို ဖော်ပြရ အသင့်တော်ဆုံးလဲ?",
            options: [
              "လူလုပ်နိုင်တာ အားလုံး လုပ်နိုင်တဲ့ general AI",
              "အလုပ်တစ်ခုမှာ ကောင်းတဲ့ narrow AI",
              "သတိရှိ၊ ကိုယ့်ကိုယ်ကို သိတယ်",
              "spreadsheet တစ်ခုပဲ",
            ],
          },
          {
            q: "Supervised learning မှာ training ဥပမာတွေမှာ ဘာ ပါသလဲ?",
            options: ["ဘာမှ မပါ", "အဖြေမှန် (label)", "reward score ပဲ", "random noise"],
            explain: "Supervised learning က label တပ်ထားတဲ့ ဥပမာနဲ့ သင်တယ်။",
          },
          {
            q: "Deep learning ရဲ့ 'deep' က ဘာကို ဆိုလိုလဲ?",
            options: [
              "model က အရမ်း ဟောင်းတယ်",
              "အလွှာများတဲ့ neural network",
              "data ကို မြေအောက်နက်နက်မှာ သိမ်းတယ်",
              "ညမှာပဲ အလုပ်လုပ်တယ်",
            ],
          },
          {
            q: "Language model က မှားတဲ့ အချက်ကို ယုံကြည်စွာ ပြောရင် ဘာလို့ ခေါ်လဲ?",
            options: ["Bug report", "Hallucination", "Firewall", "Backup"],
          },
          {
            q: "အရေးကြီးတဲ့ ဆုံးဖြတ်ချက်အတွက် AI ကို အန္တရာယ်အကင်းဆုံး သုံးနည်းက?",
            options: [
              "ပြန်မစစ်ဘဲ သူ့ဟာသူ ဆုံးဖြတ်ခိုင်း",
              "လူ တစ်ယောက် ထိန်းချုပ်ပြီး စစ်၊ ပယ်ဖျက်နိုင်စေ",
              "AI ပါဝင်မှန်း ဖုံးကွယ်",
              "ကိုယ်ရေး data အများဆုံး ကျွေး",
            ],
          },
        ],
      },
    },
  },
};
