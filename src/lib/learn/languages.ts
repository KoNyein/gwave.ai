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
  ],
};

export const LANG_COURSES: LangCourse[] = [ENGLISH, THAI, CHINESE];

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
