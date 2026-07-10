// Language-learning module for GreenWave Learn.
//
// Burmese speakers learn English, Thai and Chinese. Everything here is static
// content — no database, no external service. The interactive practice (listen,
// speak-and-check, typing) runs entirely in the browser via the Web Speech API
// (speechSynthesis for text-to-speech, SpeechRecognition for pronunciation
// scoring), so a lesson works offline once the page has loaded.

/** A single vocabulary item / phrase in a unit. */
export interface Phrase {
  /** The word or phrase in the target language (what TTS speaks). */
  target: string;
  /** A romanised pronunciation hint, friendly for a Burmese reader. */
  roman: string;
  /** The Burmese meaning. */
  my: string;
  /** A small illustrative emoji shown on the card. */
  emoji: string;
}

/** A themed unit within a language course. */
export interface LangUnit {
  slug: string;
  /** Unit title in Burmese. */
  title: string;
  /** Unit title in the target language / English, for the sub-label. */
  subtitle: string;
  emoji: string;
  items: Phrase[];
}

/** A full language course. */
export interface LangCourse {
  /** URL slug, e.g. "english". */
  slug: string;
  /** ISO-ish label used in the UI. */
  label: string;
  /** The language's own name. */
  nativeLabel: string;
  flag: string;
  /**
   * BCP-47 tag passed to speechSynthesis + SpeechRecognition so the browser
   * picks the right voice and recogniser (e.g. "en-US", "th-TH", "zh-CN").
   */
  bcp47: string;
  /** Short description in Burmese. */
  description: string;
  units: LangUnit[];
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------
const ENGLISH: LangCourse = {
  slug: "english",
  label: "English",
  nativeLabel: "English",
  flag: "🇬🇧",
  bcp47: "en-US",
  description: "အင်္ဂလိပ်စကား — နှုတ်ဆက်ခြင်းမှ ခရီးသွားစကားအထိ။",
  units: [
    {
      slug: "greetings",
      title: "နှုတ်ဆက်ခြင်း",
      subtitle: "Greetings",
      emoji: "👋",
      items: [
        { target: "Hello", roman: "ဟဲလို", my: "မင်္ဂလာပါ / ဟယ်လို", emoji: "👋" },
        { target: "Good morning", roman: "ဂွတ် မော်နင်း", my: "မင်္ဂလာနံနက်ခင်းပါ", emoji: "🌅" },
        { target: "Good night", roman: "ဂွတ် နိုက်", my: "ညချမ်းသာပါစေ", emoji: "🌙" },
        { target: "Thank you", roman: "သင့်ကျူး", my: "ကျေးဇူးတင်ပါတယ်", emoji: "🙏" },
        { target: "Sorry", roman: "ဆော်ရီ", my: "တောင်းပန်ပါတယ်", emoji: "😔" },
        { target: "How are you?", roman: "ဟောင်း အာ ယူ", my: "နေကောင်းလား", emoji: "🙂" },
        { target: "I am fine", roman: "အိုင်း အမ် ဖိုင်း", my: "ကျွန်တော် နေကောင်းပါတယ်", emoji: "👍" },
        { target: "Goodbye", roman: "ဂွတ်ဘိုင်း", my: "သွားတော့မယ် / ဘိုင်ဘိုင်", emoji: "👋" },
      ],
    },
    {
      slug: "numbers",
      title: "ဂဏန်းများ",
      subtitle: "Numbers 1–10",
      emoji: "🔢",
      items: [
        { target: "One", roman: "ဝမ်း", my: "တစ် (၁)", emoji: "1️⃣" },
        { target: "Two", roman: "တူး", my: "နှစ် (၂)", emoji: "2️⃣" },
        { target: "Three", roman: "သရီး", my: "သုံး (၃)", emoji: "3️⃣" },
        { target: "Four", roman: "ဖော်", my: "လေး (၄)", emoji: "4️⃣" },
        { target: "Five", roman: "ဖိုက်ဗ်", my: "ငါး (၅)", emoji: "5️⃣" },
        { target: "Six", roman: "စစ်ခ်", my: "ခြောက် (၆)", emoji: "6️⃣" },
        { target: "Seven", roman: "ဆဲဗင်", my: "ခုနစ် (၇)", emoji: "7️⃣" },
        { target: "Ten", roman: "တဲန်", my: "ဆယ် (၁၀)", emoji: "🔟" },
      ],
    },
    {
      slug: "food",
      title: "အစားအသောက်",
      subtitle: "Food & drink",
      emoji: "🍽️",
      items: [
        { target: "Water", roman: "ဝေါ်တာ", my: "ရေ", emoji: "💧" },
        { target: "Rice", roman: "ရိုက်စ်", my: "ထမင်း", emoji: "🍚" },
        { target: "Tea", roman: "တီး", my: "လက်ဖက်ရည်", emoji: "🍵" },
        { target: "Coffee", roman: "ကော်ဖီ", my: "ကော်ဖီ", emoji: "☕" },
        { target: "Delicious", roman: "ဒီးလစ်ရှပ်စ်", my: "စားလို့ကောင်းတယ်", emoji: "😋" },
        { target: "I am hungry", roman: "အိုင်း အမ် ဟန်ဂရီ", my: "ကျွန်တော် ဗိုက်ဆာတယ်", emoji: "🍽️" },
        { target: "The bill, please", roman: "ဒ ဘေး ပလိစ်", my: "ငွေရှင်းမယ်", emoji: "🧾" },
        { target: "How much?", roman: "ဟောင်း မတ်ချ်", my: "ဘယ်လောက်လဲ", emoji: "💰" },
      ],
    },
    {
      slug: "travel",
      title: "ခရီးသွား",
      subtitle: "Getting around",
      emoji: "🧭",
      items: [
        { target: "Where is the toilet?", roman: "ဝဲ အီးစ် ဒ တွိုင်းလက်", my: "အိမ်သာ ဘယ်မှာလဲ", emoji: "🚻" },
        { target: "Help me", roman: "ဟဲလ့်ပ် မီး", my: "ကူညီပါ", emoji: "🆘" },
        { target: "Turn left", roman: "တန်း လက်ဖ်", my: "ဘယ်ဘက်ကွေ့", emoji: "⬅️" },
        { target: "Turn right", roman: "တန်း ရိုက်", my: "ညာဘက်ကွေ့", emoji: "➡️" },
        { target: "Go straight", roman: "ဂို စတရိတ်", my: "တည့်တည့်သွား", emoji: "⬆️" },
        { target: "Stop here", roman: "စတော့ ဟီးယား", my: "ဒီမှာ ရပ်ပါ", emoji: "🛑" },
        { target: "Airport", roman: "အဲရ်ပို့", my: "လေဆိပ်", emoji: "✈️" },
        { target: "Hospital", roman: "ဟော့စ်ပီတယ်", my: "ဆေးရုံ", emoji: "🏥" },
      ],
    },
    {
      slug: "colors",
      title: "အရောင်များ",
      subtitle: "Colors",
      emoji: "🎨",
      items: [
        { target: "Red", roman: "ရက်ဒ်", my: "အနီ", emoji: "🔴" },
        { target: "Blue", roman: "ဘလူး", my: "အပြာ", emoji: "🔵" },
        { target: "Green", roman: "ဂရင်း", my: "အစိမ်း", emoji: "🟢" },
        { target: "Yellow", roman: "ယဲလိုး", my: "အဝါ", emoji: "🟡" },
        { target: "Black", roman: "ဘလက်ခ်", my: "အနက်", emoji: "⚫" },
        { target: "White", roman: "ဝှိုက်", my: "အဖြူ", emoji: "⚪" },
        { target: "Orange", roman: "အော်ရိန်း", my: "လိမ္မော်ရောင်", emoji: "🟠" },
        { target: "Pink", roman: "ပင့်ခ်", my: "ပန်းရောင်", emoji: "🩷" },
      ],
    },
    {
      slug: "family",
      title: "မိသားစု",
      subtitle: "Family",
      emoji: "👨‍👩‍👧",
      items: [
        { target: "Mother", roman: "မာသာ", my: "အမေ", emoji: "👩" },
        { target: "Father", roman: "ဖာသာ", my: "အဖေ", emoji: "👨" },
        { target: "Sister", roman: "ဆစ်စတာ", my: "အစ်မ/ညီမ", emoji: "👧" },
        { target: "Brother", roman: "ဘရာသာ", my: "အစ်ကို/ညီ", emoji: "👦" },
        { target: "Son", roman: "ဆန်း", my: "သား", emoji: "👦" },
        { target: "Daughter", roman: "ဒေါ်တာ", my: "သမီး", emoji: "👧" },
        { target: "Grandmother", roman: "ဂရန်းမာသာ", my: "အဖွား", emoji: "👵" },
        { target: "Grandfather", roman: "ဂရန်းဖာသာ", my: "အဖိုး", emoji: "👴" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Thai
// ---------------------------------------------------------------------------
const THAI: LangCourse = {
  slug: "thai",
  label: "Thai",
  nativeLabel: "ภาษาไทย",
  flag: "🇹🇭",
  bcp47: "th-TH",
  description: "ထိုင်းစကား — မြန်မာ-ထိုင်း နေ့စဉ်သုံးစကား။",
  units: [
    {
      slug: "greetings",
      title: "နှုတ်ဆက်ခြင်း",
      subtitle: "การทักทาย",
      emoji: "🙏",
      items: [
        { target: "สวัสดี", roman: "ဆဝပ်ဒီး", my: "မင်္ဂလာပါ", emoji: "🙏" },
        { target: "ขอบคุณ", roman: "ခေါ့ခုန်", my: "ကျေးဇူးတင်ပါတယ်", emoji: "🙏" },
        { target: "สบายดีไหม", roman: "ဆဘိုင်ဒီ မိုင်း", my: "နေကောင်းလား", emoji: "🙂" },
        { target: "สบายดี", roman: "ဆဘိုင်ဒီး", my: "နေကောင်းပါတယ်", emoji: "👍" },
        { target: "ขอโทษ", roman: "ခေါ်သုတ်", my: "တောင်းပန်ပါတယ်", emoji: "😔" },
        { target: "ไม่เป็นไร", roman: "မိုင် ပဲန် ရိုင်း", my: "ကိစ္စမရှိပါဘူး", emoji: "🙆" },
        { target: "ลาก่อน", roman: "လာ ကွန်း", my: "သွားတော့မယ်", emoji: "👋" },
        { target: "ยินดี", roman: "ရင်ဒီး", my: "ဝမ်းသာပါတယ်", emoji: "😊" },
      ],
    },
    {
      slug: "numbers",
      title: "ဂဏန်းများ",
      subtitle: "ตัวเลข",
      emoji: "🔢",
      items: [
        { target: "หนึ่ง", roman: "နိုင်း", my: "တစ် (၁)", emoji: "1️⃣" },
        { target: "สอง", roman: "ဆောင်", my: "နှစ် (၂)", emoji: "2️⃣" },
        { target: "สาม", roman: "ဆမ်", my: "သုံး (၃)", emoji: "3️⃣" },
        { target: "สี่", roman: "စီး", my: "လေး (၄)", emoji: "4️⃣" },
        { target: "ห้า", roman: "ဟား", my: "ငါး (၅)", emoji: "5️⃣" },
        { target: "หก", roman: "ဟုတ်", my: "ခြောက် (၆)", emoji: "6️⃣" },
        { target: "เจ็ด", roman: "ဂျက်", my: "ခုနစ် (၇)", emoji: "7️⃣" },
        { target: "สิบ", roman: "ဆစ်ပ်", my: "ဆယ် (၁၀)", emoji: "🔟" },
      ],
    },
    {
      slug: "food",
      title: "အစားအသောက်",
      subtitle: "อาหาร",
      emoji: "🍜",
      items: [
        { target: "น้ำ", roman: "နမ်", my: "ရေ", emoji: "💧" },
        { target: "ข้าว", roman: "ခေါ့", my: "ထမင်း", emoji: "🍚" },
        { target: "อร่อย", roman: "အရွိုင်း", my: "စားလို့ကောင်းတယ်", emoji: "😋" },
        { target: "เผ็ด", roman: "ဖက်", my: "စပ်တယ်", emoji: "🌶️" },
        { target: "ไม่เผ็ด", roman: "မိုင် ဖက်", my: "မစပ်ပါနဲ့", emoji: "🚫" },
        { target: "อิ่มแล้ว", roman: "အင်မ် လဲဝ်", my: "ဗိုက်ပြည့်ပြီ", emoji: "🍽️" },
        { target: "เท่าไหร่", roman: "ထောင်ရိုင်း", my: "ဘယ်လောက်လဲ", emoji: "💰" },
        { target: "เก็บเงิน", roman: "ကဲပ် ငိုန်း", my: "ငွေရှင်းမယ်", emoji: "🧾" },
      ],
    },
    {
      slug: "travel",
      title: "ခရီးသွား",
      subtitle: "การเดินทาง",
      emoji: "🧭",
      items: [
        { target: "ห้องน้ำอยู่ที่ไหน", roman: "ဟောင်နမ် ယူ ထီ နိုင်း", my: "အိမ်သာ ဘယ်မှာလဲ", emoji: "🚻" },
        { target: "ช่วยด้วย", roman: "ချွေ ဒွေး", my: "ကူညီပါ", emoji: "🆘" },
        { target: "เลี้ยวซ้าย", roman: "လျဲဝ် ဆိုင်း", my: "ဘယ်ဘက်ကွေ့", emoji: "⬅️" },
        { target: "เลี้ยวขวา", roman: "လျဲဝ် ခွာ", my: "ညာဘက်ကွေ့", emoji: "➡️" },
        { target: "ตรงไป", roman: "တရုံ ပိုင်း", my: "တည့်တည့်သွား", emoji: "⬆️" },
        { target: "หยุดตรงนี้", roman: "ယွတ် တရုံ နီး", my: "ဒီမှာ ရပ်ပါ", emoji: "🛑" },
        { target: "สนามบิน", roman: "ဆနမ် ဘင်", my: "လေဆိပ်", emoji: "✈️" },
        { target: "โรงพยาบาล", roman: "ရုံ ဖယာဘန်", my: "ဆေးရုံ", emoji: "🏥" },
      ],
    },
    {
      slug: "colors",
      title: "အရောင်များ",
      subtitle: "สี",
      emoji: "🎨",
      items: [
        { target: "สีแดง", roman: "စီ ဒဲင်", my: "အနီ", emoji: "🔴" },
        { target: "สีน้ำเงิน", roman: "စီ နမ်ငိုန်", my: "အပြာ", emoji: "🔵" },
        { target: "สีเขียว", roman: "စီ ခဲဝ်", my: "အစိမ်း", emoji: "🟢" },
        { target: "สีเหลือง", roman: "စီ လွမ်", my: "အဝါ", emoji: "🟡" },
        { target: "สีดำ", roman: "စီ ဒမ်", my: "အနက်", emoji: "⚫" },
        { target: "สีขาว", roman: "စီ ခေါ့", my: "အဖြူ", emoji: "⚪" },
        { target: "สีส้ม", roman: "စီ ဆုမ်", my: "လိမ္မော်ရောင်", emoji: "🟠" },
        { target: "สีชมพู", roman: "စီ ချုမ်ဖူး", my: "ပန်းရောင်", emoji: "🩷" },
      ],
    },
    {
      slug: "family",
      title: "မိသားစု",
      subtitle: "ครอบครัว",
      emoji: "👨‍👩‍👧",
      items: [
        { target: "แม่", roman: "မဲ", my: "အမေ", emoji: "👩" },
        { target: "พ่อ", roman: "ဖေါ်", my: "အဖေ", emoji: "👨" },
        { target: "พี่สาว", roman: "ဖီ ဆော်", my: "အစ်မ", emoji: "👧" },
        { target: "น้องสาว", roman: "နောင် ဆော်", my: "ညီမ", emoji: "👧" },
        { target: "พี่ชาย", roman: "ဖီ ချိုင်း", my: "အစ်ကို", emoji: "👦" },
        { target: "ลูก", roman: "လူးခ်", my: "သားသမီး", emoji: "🧒" },
        { target: "ยาย", roman: "ယိုင်း", my: "အဖွား", emoji: "👵" },
        { target: "ปู่", roman: "ပူး", my: "အဖိုး", emoji: "👴" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Chinese (Mandarin)
// ---------------------------------------------------------------------------
const CHINESE: LangCourse = {
  slug: "chinese",
  label: "Chinese",
  nativeLabel: "中文",
  flag: "🇨🇳",
  bcp47: "zh-CN",
  description: "တရုတ်စကား (မန်ဒရင်း) — pinyin ဖြင့် အခြေခံ။",
  units: [
    {
      slug: "greetings",
      title: "နှုတ်ဆက်ခြင်း",
      subtitle: "问候",
      emoji: "🙏",
      items: [
        { target: "你好", roman: "နီ ဟောင် (nǐ hǎo)", my: "မင်္ဂလာပါ", emoji: "👋" },
        { target: "谢谢", roman: "ရှဲ့ ရှဲ့ (xièxie)", my: "ကျေးဇူးတင်ပါတယ်", emoji: "🙏" },
        { target: "你好吗", roman: "နီ ဟောင် မာ (nǐ hǎo ma)", my: "နေကောင်းလား", emoji: "🙂" },
        { target: "我很好", roman: "ဝေါ် ဟင်း ဟောင် (wǒ hěn hǎo)", my: "ကျွန်တော် နေကောင်းပါတယ်", emoji: "👍" },
        { target: "对不起", roman: "တွေ့ ပူ ချီ (duìbuqǐ)", my: "တောင်းပန်ပါတယ်", emoji: "😔" },
        { target: "没关系", roman: "မေ့ ကွမ်း ရှီ (méi guānxi)", my: "ကိစ္စမရှိပါ", emoji: "🙆" },
        { target: "再见", roman: "ဇိုင် ကျဲန် (zàijiàn)", my: "သွားတော့မယ်", emoji: "👋" },
        { target: "欢迎", roman: "ဟွမ်း ယင်း (huānyíng)", my: "ကြိုဆိုပါတယ်", emoji: "🎉" },
      ],
    },
    {
      slug: "numbers",
      title: "ဂဏန်းများ",
      subtitle: "数字",
      emoji: "🔢",
      items: [
        { target: "一", roman: "ရီ (yī)", my: "တစ် (၁)", emoji: "1️⃣" },
        { target: "二", roman: "အာ (èr)", my: "နှစ် (၂)", emoji: "2️⃣" },
        { target: "三", roman: "ဆန်း (sān)", my: "သုံး (၃)", emoji: "3️⃣" },
        { target: "四", roman: "စ (sì)", my: "လေး (၄)", emoji: "4️⃣" },
        { target: "五", roman: "ဝူး (wǔ)", my: "ငါး (၅)", emoji: "5️⃣" },
        { target: "六", roman: "လျို့ (liù)", my: "ခြောက် (၆)", emoji: "6️⃣" },
        { target: "七", roman: "ချီ (qī)", my: "ခုနစ် (၇)", emoji: "7️⃣" },
        { target: "十", roman: "ရှစ် (shí)", my: "ဆယ် (၁၀)", emoji: "🔟" },
      ],
    },
    {
      slug: "food",
      title: "အစားအသောက်",
      subtitle: "食物",
      emoji: "🍜",
      items: [
        { target: "水", roman: "ရွှေ (shuǐ)", my: "ရေ", emoji: "💧" },
        { target: "米饭", roman: "မီ ဖန် (mǐfàn)", my: "ထမင်း", emoji: "🍚" },
        { target: "茶", roman: "ချာ (chá)", my: "လက်ဖက်ရည်", emoji: "🍵" },
        { target: "好吃", roman: "ဟောင် ချ (hǎochī)", my: "စားလို့ကောင်းတယ်", emoji: "😋" },
        { target: "我饿了", roman: "ဝေါ် အာ့ လ (wǒ è le)", my: "ကျွန်တော် ဗိုက်ဆာတယ်", emoji: "🍽️" },
        { target: "多少钱", roman: "တွော် ရှောင် ချဲန် (duōshao qián)", my: "ဘယ်လောက်လဲ", emoji: "💰" },
        { target: "买单", roman: "မိုင် တန်း (mǎidān)", my: "ငွေရှင်းမယ်", emoji: "🧾" },
        { target: "好喝", roman: "ဟောင် ဟ (hǎohē)", my: "သောက်လို့ကောင်းတယ်", emoji: "🥤" },
      ],
    },
    {
      slug: "travel",
      title: "ခရီးသွား",
      subtitle: "出行",
      emoji: "🧭",
      items: [
        { target: "厕所在哪里", roman: "ဆဲ ဆော် ဇိုင် နာ လီ (cèsuǒ zài nǎlǐ)", my: "အိမ်သာ ဘယ်မှာလဲ", emoji: "🚻" },
        { target: "帮帮我", roman: "ပန်း ပန်း ဝေါ် (bāng bāng wǒ)", my: "ကူညီပါ", emoji: "🆘" },
        { target: "左转", roman: "ဇွော် ကျွမ်း (zuǒ zhuǎn)", my: "ဘယ်ဘက်ကွေ့", emoji: "⬅️" },
        { target: "右转", roman: "ယို့ ကျွမ်း (yòu zhuǎn)", my: "ညာဘက်ကွေ့", emoji: "➡️" },
        { target: "一直走", roman: "ရီ ကျ ဇို့ (yìzhí zǒu)", my: "တည့်တည့်သွား", emoji: "⬆️" },
        { target: "停这里", roman: "သင်း ကျဲ့ လီ (tíng zhèlǐ)", my: "ဒီမှာ ရပ်ပါ", emoji: "🛑" },
        { target: "机场", roman: "ကျီ ချမ်း (jīchǎng)", my: "လေဆိပ်", emoji: "✈️" },
        { target: "医院", roman: "ရီ ယွမ်း (yīyuàn)", my: "ဆေးရုံ", emoji: "🏥" },
      ],
    },
    {
      slug: "colors",
      title: "အရောင်များ",
      subtitle: "颜色",
      emoji: "🎨",
      items: [
        { target: "红色", roman: "ဟုံ့ စ (hóngsè)", my: "အနီ", emoji: "🔴" },
        { target: "蓝色", roman: "လန် စ (lánsè)", my: "အပြာ", emoji: "🔵" },
        { target: "绿色", roman: "လွစ် စ (lǜsè)", my: "အစိမ်း", emoji: "🟢" },
        { target: "黄色", roman: "ဟွမ်း စ (huángsè)", my: "အဝါ", emoji: "🟡" },
        { target: "黑色", roman: "ဟေး စ (hēisè)", my: "အနက်", emoji: "⚫" },
        { target: "白色", roman: "ပိုင် စ (báisè)", my: "အဖြူ", emoji: "⚪" },
        { target: "橙色", roman: "ချုန်း စ (chéngsè)", my: "လိမ္မော်ရောင်", emoji: "🟠" },
        { target: "粉色", roman: "ဖင့် စ (fěnsè)", my: "ပန်းရောင်", emoji: "🩷" },
      ],
    },
    {
      slug: "family",
      title: "မိသားစု",
      subtitle: "家人",
      emoji: "👨‍👩‍👧",
      items: [
        { target: "妈妈", roman: "မားမ (māma)", my: "အမေ", emoji: "👩" },
        { target: "爸爸", roman: "ပါ့ပ (bàba)", my: "အဖေ", emoji: "👨" },
        { target: "姐姐", roman: "ကျဲ့ကျဲ့ (jiějie)", my: "အစ်မ", emoji: "👧" },
        { target: "妹妹", roman: "မေ့မေ့ (mèimei)", my: "ညီမ", emoji: "👧" },
        { target: "哥哥", roman: "ကဲကဲ (gēge)", my: "အစ်ကို", emoji: "👦" },
        { target: "儿子", roman: "အာ့ဇ (érzi)", my: "သား", emoji: "👦" },
        { target: "女儿", roman: "နွယ် အာ (nǚ'ér)", my: "သမီး", emoji: "👧" },
        { target: "奶奶", roman: "နိုင်နိုင် (nǎinai)", my: "အဖွား", emoji: "👵" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Japanese
// ---------------------------------------------------------------------------
const JAPANESE: LangCourse = {
  slug: "japanese",
  label: "Japanese",
  nativeLabel: "日本語",
  flag: "🇯🇵",
  bcp47: "ja-JP",
  description: "ဂျပန်စကား — romaji ဖြင့် အခြေခံ။",
  units: [
    {
      slug: "greetings",
      title: "နှုတ်ဆက်ခြင်း",
      subtitle: "あいさつ",
      emoji: "🙇",
      items: [
        { target: "こんにちは", roman: "ကွန်နိချိဝ (konnichiwa)", my: "မင်္ဂလာပါ (နေ့ခင်း)", emoji: "👋" },
        { target: "おはよう", roman: "အိုဟာယော် (ohayō)", my: "မင်္ဂလာနံနက်ခင်းပါ", emoji: "🌅" },
        { target: "こんばんは", roman: "ကွန်ဘန်ဝ (konbanwa)", my: "မင်္ဂလာ ညနေခင်းပါ", emoji: "🌆" },
        { target: "ありがとう", roman: "အာရိဂတော် (arigatō)", my: "ကျေးဇူးတင်ပါတယ်", emoji: "🙏" },
        { target: "すみません", roman: "ဆုမိမာဆဲန် (sumimasen)", my: "တောင်းပန်ပါတယ် / ခွင့်ပြုပါ", emoji: "😔" },
        { target: "はい", roman: "ဟိုင် (hai)", my: "ဟုတ်ကဲ့", emoji: "✅" },
        { target: "いいえ", roman: "အီးအဲ (iie)", my: "မဟုတ်ဘူး", emoji: "❌" },
        { target: "さようなら", roman: "ဆာယောနာရ (sayōnara)", my: "သွားတော့မယ်", emoji: "👋" },
      ],
    },
    {
      slug: "numbers",
      title: "ဂဏန်းများ",
      subtitle: "数字",
      emoji: "🔢",
      items: [
        { target: "一", roman: "အိချိ (ichi)", my: "တစ် (၁)", emoji: "1️⃣" },
        { target: "二", roman: "နိ (ni)", my: "နှစ် (၂)", emoji: "2️⃣" },
        { target: "三", roman: "ဆန် (san)", my: "သုံး (၃)", emoji: "3️⃣" },
        { target: "四", roman: "ရှိ / ယွန် (shi/yon)", my: "လေး (၄)", emoji: "4️⃣" },
        { target: "五", roman: "ဂေါ် (go)", my: "ငါး (၅)", emoji: "5️⃣" },
        { target: "六", roman: "ရော်ကု (roku)", my: "ခြောက် (၆)", emoji: "6️⃣" },
        { target: "七", roman: "နာနာ / ရှိချိ (nana)", my: "ခုနစ် (၇)", emoji: "7️⃣" },
        { target: "十", roman: "ဂျူး (jū)", my: "ဆယ် (၁၀)", emoji: "🔟" },
      ],
    },
    {
      slug: "food",
      title: "အစားအသောက်",
      subtitle: "食べ物",
      emoji: "🍱",
      items: [
        { target: "水", roman: "မိဇု (mizu)", my: "ရေ", emoji: "💧" },
        { target: "ご飯", roman: "ဂိုဟန် (gohan)", my: "ထမင်း", emoji: "🍚" },
        { target: "お茶", roman: "အိုချ (ocha)", my: "လက်ဖက်ရည်", emoji: "🍵" },
        { target: "おいしい", roman: "အွိုင်ရှီး (oishii)", my: "စားလို့ကောင်းတယ်", emoji: "😋" },
        { target: "いただきます", roman: "အိတဒကိမာစု (itadakimasu)", my: "စားတော့မယ် (မစားခင်)", emoji: "🍽️" },
        { target: "いくらですか", roman: "အိကုရ ဒက်စ်က (ikura desu ka)", my: "ဘယ်လောက်လဲ", emoji: "💰" },
        { target: "お会計", roman: "အိုကိုင်းကေး (okaikei)", my: "ငွေရှင်းမယ်", emoji: "🧾" },
        { target: "お腹すいた", roman: "အိုနာက ဆွိုက်တ (onaka suita)", my: "ဗိုက်ဆာတယ်", emoji: "😩" },
      ],
    },
    {
      slug: "travel",
      title: "ခရီးသွား",
      subtitle: "移動",
      emoji: "🧭",
      items: [
        { target: "トイレはどこですか", roman: "တွိုင်းရေ ဝ ဒေါ်ကို ဒက်စ်က (toire wa doko desu ka)", my: "အိမ်သာ ဘယ်မှာလဲ", emoji: "🚻" },
        { target: "助けて", roman: "တစုကေတဲ (tasukete)", my: "ကူညီပါ", emoji: "🆘" },
        { target: "左", roman: "ဟိဒရိ (hidari)", my: "ဘယ်ဘက်", emoji: "⬅️" },
        { target: "右", roman: "မိဂိ (migi)", my: "ညာဘက်", emoji: "➡️" },
        { target: "まっすぐ", roman: "မတ်ဆုဂု (massugu)", my: "တည့်တည့်", emoji: "⬆️" },
        { target: "ここで止まって", roman: "ကိုကို ဒဲ တိုမတ်တဲ (koko de tomatte)", my: "ဒီမှာ ရပ်ပါ", emoji: "🛑" },
        { target: "空港", roman: "ကူးကော် (kūkō)", my: "လေဆိပ်", emoji: "✈️" },
        { target: "病院", roman: "ဗျိုးအင် (byōin)", my: "ဆေးရုံ", emoji: "🏥" },
      ],
    },
    {
      slug: "colors",
      title: "အရောင်များ",
      subtitle: "色",
      emoji: "🎨",
      items: [
        { target: "赤", roman: "အက (aka)", my: "အနီ", emoji: "🔴" },
        { target: "青", roman: "အအို (ao)", my: "အပြာ", emoji: "🔵" },
        { target: "緑", roman: "မိဒေါ်ရိ (midori)", my: "အစိမ်း", emoji: "🟢" },
        { target: "黄色", roman: "ကီးရော် (kiiro)", my: "အဝါ", emoji: "🟡" },
        { target: "黒", roman: "ကုရော် (kuro)", my: "အနက်", emoji: "⚫" },
        { target: "白", roman: "ရှိရော် (shiro)", my: "အဖြူ", emoji: "⚪" },
        { target: "オレンジ", roman: "အိုရဲန်ဂျိ (orenji)", my: "လိမ္မော်ရောင်", emoji: "🟠" },
        { target: "ピンク", roman: "ပင်းကု (pinku)", my: "ပန်းရောင်", emoji: "🩷" },
      ],
    },
    {
      slug: "family",
      title: "မိသားစု",
      subtitle: "家族",
      emoji: "👨‍👩‍👧",
      items: [
        { target: "母", roman: "ဟဟ (haha)", my: "အမေ", emoji: "👩" },
        { target: "父", roman: "ချိချိ (chichi)", my: "အဖေ", emoji: "👨" },
        { target: "姉", roman: "အနဲ (ane)", my: "အစ်မ", emoji: "👧" },
        { target: "妹", roman: "အိမိုတော် (imōto)", my: "ညီမ", emoji: "👧" },
        { target: "兄", roman: "အနိ (ani)", my: "အစ်ကို", emoji: "👦" },
        { target: "息子", roman: "မုစုကော် (musuko)", my: "သား", emoji: "👦" },
        { target: "娘", roman: "မုစုမဲ (musume)", my: "သမီး", emoji: "👧" },
        { target: "祖母", roman: "ဆိုဘော် (sobo)", my: "အဖွား", emoji: "👵" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Korean
// ---------------------------------------------------------------------------
const KOREAN: LangCourse = {
  slug: "korean",
  label: "Korean",
  nativeLabel: "한국어",
  flag: "🇰🇷",
  bcp47: "ko-KR",
  description: "ကိုရီးယားစကား — Hangul ဖြင့် အခြေခံ။",
  units: [
    {
      slug: "greetings",
      title: "နှုတ်ဆက်ခြင်း",
      subtitle: "인사",
      emoji: "🙇",
      items: [
        { target: "안녕하세요", roman: "အန်ညောင်ဟာဆေးယို (annyeonghaseyo)", my: "မင်္ဂလာပါ", emoji: "👋" },
        { target: "감사합니다", roman: "ကမ်ဆာဟမ်နီဒ (gamsahamnida)", my: "ကျေးဇူးတင်ပါတယ်", emoji: "🙏" },
        { target: "죄송합니다", roman: "ချွယ်ဆောင်ဟမ်နီဒ (joesonghamnida)", my: "တောင်းပန်ပါတယ်", emoji: "😔" },
        { target: "네", roman: "နဲ (ne)", my: "ဟုတ်ကဲ့", emoji: "✅" },
        { target: "아니요", roman: "အာနီယို (aniyo)", my: "မဟုတ်ဘူး", emoji: "❌" },
        { target: "잘 지내세요?", roman: "ချယ် ချီနဲဆေးယို (jal jinaeseyo)", my: "နေကောင်းလား", emoji: "🙂" },
        { target: "안녕히 가세요", roman: "အန်ညောင်ဟီ ကာဆေးယို (annyeonghi gaseyo)", my: "သွားတော့မယ်", emoji: "👋" },
        { target: "반갑습니다", roman: "ပန်ကပ်စမ်နီဒ (bangapseumnida)", my: "တွေ့ရတာ ဝမ်းသာပါတယ်", emoji: "😊" },
      ],
    },
    {
      slug: "numbers",
      title: "ဂဏန်းများ",
      subtitle: "숫자",
      emoji: "🔢",
      items: [
        { target: "일", roman: "အိလ် (il)", my: "တစ် (၁)", emoji: "1️⃣" },
        { target: "이", roman: "အီး (i)", my: "နှစ် (၂)", emoji: "2️⃣" },
        { target: "삼", roman: "ဆမ် (sam)", my: "သုံး (၃)", emoji: "3️⃣" },
        { target: "사", roman: "ဆာ (sa)", my: "လေး (၄)", emoji: "4️⃣" },
        { target: "오", roman: "အို (o)", my: "ငါး (၅)", emoji: "5️⃣" },
        { target: "육", roman: "ယွတ် (yuk)", my: "ခြောက် (၆)", emoji: "6️⃣" },
        { target: "칠", roman: "ချိလ် (chil)", my: "ခုနစ် (၇)", emoji: "7️⃣" },
        { target: "십", roman: "ရှစ်ပ် (sip)", my: "ဆယ် (၁၀)", emoji: "🔟" },
      ],
    },
    {
      slug: "food",
      title: "အစားအသောက်",
      subtitle: "음식",
      emoji: "🍚",
      items: [
        { target: "물", roman: "မွုလ် (mul)", my: "ရေ", emoji: "💧" },
        { target: "밥", roman: "ပပ် (bap)", my: "ထမင်း", emoji: "🍚" },
        { target: "차", roman: "ချာ (cha)", my: "လက်ဖက်ရည်", emoji: "🍵" },
        { target: "맛있어요", roman: "မာရှိဆောယို (masisseoyo)", my: "စားလို့ကောင်းတယ်", emoji: "😋" },
        { target: "매워요", roman: "မဲဝေါယို (maewoyo)", my: "စပ်တယ်", emoji: "🌶️" },
        { target: "배고파요", roman: "ပဲကိုပါယို (baegopayo)", my: "ဗိုက်ဆာတယ်", emoji: "😩" },
        { target: "얼마예요", roman: "အောလ်မာယဲယို (eolmayeyo)", my: "ဘယ်လောက်လဲ", emoji: "💰" },
        { target: "계산해 주세요", roman: "ကယဆန်ဟဲ ဂျုဆေးယို (gyesanhae juseyo)", my: "ငွေရှင်းမယ်", emoji: "🧾" },
      ],
    },
    {
      slug: "travel",
      title: "ခရီးသွား",
      subtitle: "이동",
      emoji: "🧭",
      items: [
        { target: "화장실이 어디예요?", roman: "ဟွာဂျန်ရှီလိ အောဒီယဲယို (hwajangsiri eodiyeyo)", my: "အိမ်သာ ဘယ်မှာလဲ", emoji: "🚻" },
        { target: "도와주세요", roman: "တိုဝါဂျုဆေးယို (dowajuseyo)", my: "ကူညီပါ", emoji: "🆘" },
        { target: "왼쪽", roman: "ဝဲန်ချောက် (oenjjok)", my: "ဘယ်ဘက်", emoji: "⬅️" },
        { target: "오른쪽", roman: "အောရွန်ချောက် (oreunjjok)", my: "ညာဘက်", emoji: "➡️" },
        { target: "직진", roman: "ချစ်ဂျင် (jikjin)", my: "တည့်တည့်", emoji: "⬆️" },
        { target: "여기서 세워 주세요", roman: "ယောဂီဆော ဆယ်ဝေါ ဂျုဆေးယို (yeogiseo sewo juseyo)", my: "ဒီမှာ ရပ်ပါ", emoji: "🛑" },
        { target: "공항", roman: "ကွန်းဟန် (gonghang)", my: "လေဆိပ်", emoji: "✈️" },
        { target: "병원", roman: "ဗျောင်ဝွန် (byeongwon)", my: "ဆေးရုံ", emoji: "🏥" },
      ],
    },
    {
      slug: "colors",
      title: "အရောင်များ",
      subtitle: "색깔",
      emoji: "🎨",
      items: [
        { target: "빨간색", roman: "ပ္ပလ်ဂန်ဆဲ့ (ppalgansaek)", my: "အနီ", emoji: "🔴" },
        { target: "파란색", roman: "ဖါရန်ဆဲ့ (paransaek)", my: "အပြာ", emoji: "🔵" },
        { target: "초록색", roman: "ချိုရော့ဆဲ့ (choroksaek)", my: "အစိမ်း", emoji: "🟢" },
        { target: "노란색", roman: "နိုရန်ဆဲ့ (noransaek)", my: "အဝါ", emoji: "🟡" },
        { target: "검은색", roman: "ကောမွန်ဆဲ့ (geomeunsaek)", my: "အနက်", emoji: "⚫" },
        { target: "하얀색", roman: "ဟယန်ဆဲ့ (hayansaek)", my: "အဖြူ", emoji: "⚪" },
        { target: "주황색", roman: "ဂျုဟွမ်ဆဲ့ (juhwangsaek)", my: "လိမ္မော်ရောင်", emoji: "🟠" },
        { target: "분홍색", roman: "ပွန်ဟုံဆဲ့ (bunhongsaek)", my: "ပန်းရောင်", emoji: "🩷" },
      ],
    },
    {
      slug: "family",
      title: "မိသားစု",
      subtitle: "가족",
      emoji: "👨‍👩‍👧",
      items: [
        { target: "엄마", roman: "အောမ်မ (eomma)", my: "အမေ", emoji: "👩" },
        { target: "아빠", roman: "အာ့ပ္ပ (appa)", my: "အဖေ", emoji: "👨" },
        { target: "여동생", roman: "ယောဒုံဆဲင် (yeodongsaeng)", my: "ညီမ", emoji: "👧" },
        { target: "남동생", roman: "နမ်ဒုံဆဲင် (namdongsaeng)", my: "ညီ", emoji: "👦" },
        { target: "아들", roman: "အာဒွလ် (adeul)", my: "သား", emoji: "👦" },
        { target: "딸", roman: "တ္တလ် (ttal)", my: "သမီး", emoji: "👧" },
        { target: "할머니", roman: "ဟာလ်မောနီ (halmeoni)", my: "အဖွား", emoji: "👵" },
        { target: "할아버지", roman: "ဟာရာဗောဂျီ (harabeoji)", my: "အဖိုး", emoji: "👴" },
      ],
    },
  ],
};

export const LANG_COURSES: LangCourse[] = [
  ENGLISH,
  THAI,
  CHINESE,
  JAPANESE,
  KOREAN,
];

export function getLangCourse(slug: string): LangCourse | undefined {
  return LANG_COURSES.find((c) => c.slug === slug);
}

export function getLangUnit(
  courseSlug: string,
  unitSlug: string,
): { course: LangCourse; unit: LangUnit } | undefined {
  const course = getLangCourse(courseSlug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  if (!course || !unit) return undefined;
  return { course, unit };
}

// ---------------------------------------------------------------------------
// Bilingual on-screen labels
//
// The trainer's action words are shown in BOTH the language being studied and
// Burmese (e.g. "Listen · နားထောင်"), so a learner always sees the native term
// for the control they're using next to their own language.
// ---------------------------------------------------------------------------
export interface LangUiStrings {
  listen: string;
  speak: string;
  type: string;
  tapToSpeak: string;
  typeHint: string;
}

/** The Burmese half of every bilingual label (the audience's own language). */
export const MY_UI: LangUiStrings = {
  listen: "နားထောင်",
  speak: "အသံထွက်",
  type: "စာရိုက်",
  tapToSpeak: "နှိပ်ပြီးပြော",
  typeHint: "နားထောင်ပြီးရိုက်",
};

/** The target-language half, per course. */
export const LANG_UI: Record<string, LangUiStrings> = {
  english: {
    listen: "Listen",
    speak: "Speak",
    type: "Type",
    tapToSpeak: "Tap & speak",
    typeHint: "Listen, then type",
  },
  thai: {
    listen: "ฟัง",
    speak: "พูด",
    type: "พิมพ์",
    tapToSpeak: "แตะแล้วพูด",
    typeHint: "ฟังแล้วพิมพ์",
  },
  chinese: {
    listen: "听",
    speak: "说",
    type: "打字",
    tapToSpeak: "点击说话",
    typeHint: "边听边打",
  },
  japanese: {
    listen: "聞く",
    speak: "話す",
    type: "入力",
    tapToSpeak: "タップして話す",
    typeHint: "聞いて入力",
  },
  korean: {
    listen: "듣기",
    speak: "말하기",
    type: "입력",
    tapToSpeak: "눌러 말하기",
    typeHint: "듣고 입력",
  },
};

/** Bilingual labels for a course, falling back to English target words. */
export function getLangUi(courseSlug: string): LangUiStrings {
  return LANG_UI[courseSlug] ?? LANG_UI.english!;
}
