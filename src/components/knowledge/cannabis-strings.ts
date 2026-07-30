/**
 * Trilingual copy for the cannabis / hemp / CBD market board: Burmese,
 * English and Thai. Thai is here because Gwave's cannabis users are largely
 * growing and trading inside Thailand's post-2022 market, so the page that
 * carries Thai prices and Thai law has to be readable in Thai.
 *
 * The legal text is deliberately specific rather than a generic "check your
 * local laws": Thai cannabis rules are licence-based and have kept moving
 * (household cultivation registration, DTAM sale licences, the 0.2 % THC
 * extract line, and the 2025 prescription rules), and a vague warning would
 * be worse than none for someone actually operating there.
 */

export type CLang = "my" | "en" | "th";

export const CLANG_LABEL: Record<CLang, string> = {
  my: "မြန်မာ",
  en: "EN",
  th: "ไทย",
};

/** Next language in the my → en → th → my cycle. */
export const nextCLang: Record<CLang, CLang> = {
  my: "en",
  en: "th",
  th: "my",
};

interface Copy {
  title: string;
  adult: string;
  edu: string;
  loadError: string;
  etf: string;
  producer: string;
  us_retail: string;
  cbd_hemp: string;
  thai: string;
  etfNote: string;
  producerNote: string;
  usRetailNote: string;
  cbdNote: string;
  thaiNote: string;
  whyStocks: string;
  disclaimer: string;
  legalTitle: string;
  legalThai: string;
  updated: string;
  refresh: string;
  logTitle: string;
  logEmpty: string;
  logAdd: string;
  logClose: string;
  logSave: string;
  logSaving: string;
  logDisclaimer: string;
  formErr: string;
  phName: string;
  phGrade: string;
  phPrice: string;
  phMarket: string;
  phNote: string;
}

export const CSTR: Record<CLang, Copy> = {
  my: {
    title: "ဆေးခြောက် / Hemp / CBD ဈေးကွက် (ပညာပေး)",
    adult: "၁၈+ သီးသန့်",
    edu: "ပညာပေးရည်ရွယ်ချက်သာ",
    loadError: "ဈေးနှုန်း ယူ၍မရသေးပါ — ခဏနေ ပြန်စမ်းပါ။",
    etf: "ကဏ္ဍ ETF များ (ဈေးကွက်အညွှန်းကိန်း)",
    producer: "ထုတ်လုပ်သူကြီးများ (ကနေဒါ)",
    us_retail: "အမေရိကန် လက်လီလုပ်ငန်းများ (OTC)",
    cbd_hemp: "Hemp / CBD စီးပွားရေး",
    thai: "🇹🇭 ထိုင်းနိုင်ငံ (SET စာရင်းဝင်)",
    etfNote:
      "ကုမ္ပဏီတစ်ခုတည်းမဟုတ်ဘဲ ကဏ္ဍတစ်ခုလုံးကို ကိုယ်စားပြုတဲ့ ရန်ပုံငွေများ — ဈေးကွက်အခြေအနေ ခြုံကြည့်ရန် အသင့်တော်ဆုံး။",
    producerNote:
      "ကနေဒါက ဖက်ဒရယ်အဆင့် တရားဝင်တဲ့ ကမ္ဘာ့ပထမဆုံး ဈေးကွက် — ထုတ်လုပ်သူကြီးများ NASDAQ မှာ စာရင်းဝင်။",
    usRetailNote:
      "အမေရိကန်မှာ ပြည်နယ်အဆင့်သာ တရားဝင်ပြီး ဖက်ဒရယ်ဥပဒေကြောင့် ကုမ္ပဏီတွေ OTC ဈေးကွက်မှာသာ ရောင်းဝယ်ရ။",
    cbdNote:
      "Hemp (THC နည်း) နှင့် CBD ထုတ်ကုန် စီးပွားရေး — ကမ္ဘာ့နိုင်ငံအများအပြားမှာ ဆေးခြောက်နှင့် ဥပဒေအရ သီးခြားစီ သတ်မှတ်။",
    thaiNote:
      "ထိုင်းသည် ၂၀၂၂ ခုနှစ်တွင် ဆေးခြောက်ကို မူးယစ်ဇယား ၅ မှ ဖြုတ်ခဲ့သည် — သို့သော် အပွင့် (flower) ကို ကုန်စည်အဖြစ် ရောင်းဝယ်တဲ့ exchange မရှိပါ။ ဒါကြောင့် ရနိုင်တာက SET စာရင်းဝင် ကုမ္ပဏီရှယ်ယာဈေး (THB) နှင့် အောက်က လက်ရေးမှတ်တမ်း ဈေးများသာ ဖြစ်သည်။",
    whyStocks:
      "ဘာလို့ ကုမ္ပဏီရှယ်ယာဈေးတွေလဲ? — ဆေးခြောက်ကို commodity အနေနဲ့ ရောင်းဝယ်တဲ့ exchange မရှိပါ။ လက်ကား hemp/CBD စံဈေး (Hemp Benchmarks™) တွေက licence ဝယ်ရတဲ့ feed များဖြစ်လို့ မမှန်တဲ့ဂဏန်း မပြဘဲ အများပြည်သူကြည့်နိုင်တဲ့ ရှယ်ယာဈေးများကိုသာ ပြထားပါသည်။",
    disclaimer:
      "⚠️ သတိပေးချက် — ဤစာမျက်နှာသည် ပညာပေးရည်ရွယ်ချက်သာဖြစ်သည်။ ရင်းနှီးမြှုပ်နှံမှု အကြံဉာဏ် မဟုတ်ပါ။ ရောင်းဝယ်ရန် ကမ်းလှမ်းချက် သို့မဟုတ် ကြော်ငြာ လုံးဝ မဟုတ်ပါ။ မြန်မာနိုင်ငံတွင် ဆေးခြောက် လက်ဝယ်ထား/ရောင်းဝယ်ခြင်းသည် တရားမဝင်ပါ။",
    legalTitle: "🇹🇭 ထိုင်းဥပဒေ — လိုက်နာရမည့်အချက်များ",
    legalThai:
      "• စိုက်ပျိုးမှု — အိမ်တွင်းစိုက်ပျိုးမှုပါ ထိုင်း FDA တွင် မှတ်ပုံတင်ရသည်။\n• ရောင်းချမှု — ဆိုင်ဖွင့်ရောင်းရန် ထိုင်းရိုးရာဆေးဌာန (DTAM) မှ လိုင်စင် လိုအပ်သည်။\n• THC ၀.၂% အထက် ပါဝင်သော extract များသည် မူးယစ်ဆေးဝါးအဖြစ် ဆက်လက် ထိန်းချုပ်ခံရသည်။\n• အသက် ၂၀ အောက်၊ ကိုယ်ဝန်ရှိသူနှင့် နို့တိုက်မိခင်များအား ရောင်းချခြင်း တားမြစ်။\n• အပန်းဖြေအလို့ငှာ ကြော်ငြာ/မြှင့်တင်ခြင်း တားမြစ်ပြီး လူစည်ကားရာတွင် သောက်ခြင်းမှာ ပြည်သူ့ကျန်းမာရေးဥပဒေအရ အပြစ်ပေးခံရနိုင်သည်။\n• ၂၀၂၅ တွင် ဝယ်ယူရန် ဆရာဝန်စာ (prescription) လိုအပ်သည့် စည်းမျဉ်းများ ထွက်ပေါ်လာသည် — စည်းမျဉ်းများ ဆက်တိုက် ပြောင်းလဲနေသဖြင့် လုပ်ဆောင်မီ တာဝန်ရှိအာဏာပိုင်များနှင့် သေချာစစ်ဆေးပါ။",
    updated: "နောက်ဆုံး update",
    refresh: "ပြန်ဆွဲ",
    logTitle: "🇹🇭 ထိုင်းဈေး မှတ်တမ်း (လက်ရေး — dispensary / လက်ကား)",
    logEmpty:
      "မှတ်တမ်း မရှိသေးပါ — ထိုင်းဈေးကွက်တွင် အပွင့်ဈေးက exchange မှာ မရှိသဖြင့် admin က grade၊ ဒေသ၊ ရက်စွဲနှင့်တကွ ဤနေရာတွင် မှတ်တမ်းတင်ပါသည်။",
    logAdd: "+ ဈေးထည့်",
    logClose: "ပိတ်မည်",
    logSave: "မှတ်တမ်းတင်မည်",
    logSaving: "သိမ်းနေသည်…",
    logDisclaimer:
      "ဤဈေးများသည် လူကိုယ်တိုင် မှတ်တမ်းတင်ထားသော ကိုးကားဈေးများဖြစ်ပြီး exchange ဈေး မဟုတ်ပါ — ရက်စွဲကို ကြည့်ပါ။ ရောင်းဝယ်ရန် ကမ်းလှမ်းချက် မဟုတ်ပါ။",
    formErr: "အမည်၊ ဈေးနှုန်းနှင့် ဒေသ ဖြည့်ပါ။",
    phName: "ပစ္စည်းအမည် (ဥပမာ — Indoor အပွင့်)",
    phGrade: "Grade (ဥပမာ — top shelf / smalls / trim)",
    phPrice: "ဈေးနှုန်း",
    phMarket: "ဒေသ / ဈေးကွက် (ဥပမာ — ဘန်ကောက်)",
    phNote: "မှတ်ချက် (ရွေးချယ်)",
  },
  en: {
    title: "Cannabis / Hemp / CBD markets (educational)",
    adult: "18+ only",
    edu: "Educational purposes only",
    loadError: "Could not load prices — try again shortly.",
    etf: "Sector ETFs (market index)",
    producer: "Licensed producers (Canada)",
    us_retail: "US retailers (OTC)",
    cbd_hemp: "Hemp / CBD economy",
    thai: "🇹🇭 Thailand (SET-listed)",
    etfNote:
      "Funds that track the whole sector rather than one company — the best single view of market conditions.",
    producerNote:
      "Canada is the first federally legal market; the major producers list on NASDAQ.",
    usRetailNote:
      "US cannabis is state-legal only, so these companies trade OTC because of federal law.",
    cbdNote:
      "The hemp (low-THC) and CBD product economy — legally distinct from cannabis in most countries.",
    thaiNote:
      "Thailand removed cannabis from narcotics Category 5 in 2022, but no exchange trades the flower as a commodity. What exists is SET-listed company shares (in THB) plus the hand-recorded quotes below.",
    whyStocks:
      "Why stock prices? No exchange trades cannabis as a commodity, and wholesale hemp/CBD benchmarks (Hemp Benchmarks™) are licensed feeds — so rather than invent numbers, this board shows the public listed-equity market.",
    disclaimer:
      "⚠️ Disclaimer — this page is for education only. It is NOT investment advice, and NOT an offer, advertisement or inducement to buy or sell cannabis. Cannabis possession and trade are illegal in Myanmar.",
    legalTitle: "🇹🇭 Thai law — what compliance requires",
    legalThai:
      "• Cultivation — even household growing must be registered with the Thai FDA.\n• Selling — a retail licence from the Department of Thai Traditional and Alternative Medicine (DTAM) is required.\n• Extracts containing more than 0.2 % THC remain controlled narcotics.\n• Sale to under-20s, pregnant and breastfeeding people is prohibited.\n• Advertising or promoting recreational use is prohibited, and smoking in public can be penalised under the Public Health Act.\n• In 2025 rules requiring a doctor's prescription to buy were introduced — regulation keeps changing, so verify with the authorities before acting.",
    updated: "Last updated",
    refresh: "Refresh",
    logTitle: "🇹🇭 Thai price log (hand-recorded — dispensary / wholesale)",
    logEmpty:
      "No quotes yet — Thai flower prices don't exist on any exchange, so an admin records them here with grade, area and date.",
    logAdd: "+ Add quote",
    logClose: "Close",
    logSave: "Save quote",
    logSaving: "Saving…",
    logDisclaimer:
      "These are hand-recorded reference prices, not exchange quotes — check the date. Not an offer to trade.",
    formErr: "Fill in name, price and market.",
    phName: "Product (e.g. indoor flower)",
    phGrade: "Grade (e.g. top shelf / smalls / trim)",
    phPrice: "Price",
    phMarket: "Area / market (e.g. Bangkok)",
    phNote: "Note (optional)",
  },
  th: {
    title: "ตลาดกัญชา / เฮมป์ / CBD (เพื่อการศึกษา)",
    adult: "อายุ 18+ เท่านั้น",
    edu: "เพื่อการศึกษาเท่านั้น",
    loadError: "ยังโหลดราคาไม่ได้ — โปรดลองอีกครั้ง",
    etf: "กองทุน ETF ของกลุ่ม (ดัชนีตลาด)",
    producer: "ผู้ผลิตที่ได้รับอนุญาต (แคนาดา)",
    us_retail: "ผู้ค้าปลีกสหรัฐ (OTC)",
    cbd_hemp: "ธุรกิจเฮมป์ / CBD",
    thai: "🇹🇭 ไทย (จดทะเบียนใน SET)",
    etfNote:
      "กองทุนที่ติดตามภาพรวมทั้งกลุ่ม ไม่ใช่บริษัทเดียว — เหมาะที่สุดสำหรับดูภาพรวมตลาด",
    producerNote:
      "แคนาดาเป็นตลาดแรกที่ถูกกฎหมายระดับประเทศ ผู้ผลิตรายใหญ่จดทะเบียนใน NASDAQ",
    usRetailNote:
      "กัญชาในสหรัฐถูกกฎหมายเฉพาะระดับรัฐ บริษัทเหล่านี้จึงซื้อขายในตลาด OTC เพราะกฎหมายกลาง",
    cbdNote:
      "ธุรกิจเฮมป์ (THC ต่ำ) และผลิตภัณฑ์ CBD — ตามกฎหมายส่วนใหญ่แยกจากกัญชา",
    thaiNote:
      "ไทยปลดกัญชาออกจากยาเสพติดประเภท 5 ในปี 2565 แต่ไม่มีตลาดกลางที่ซื้อขายช่อดอกเป็นสินค้าโภคภัณฑ์ สิ่งที่มีคือราคาหุ้นบริษัทในตลาด SET (สกุลบาท) และราคาที่บันทึกด้วยมือด้านล่าง",
    whyStocks:
      "ทำไมต้องเป็นราคาหุ้น? เพราะไม่มีตลาดกลางที่ซื้อขายกัญชาเป็นสินค้าโภคภัณฑ์ และราคาอ้างอิงขายส่งเฮมป์/CBD (Hemp Benchmarks™) เป็นข้อมูลที่ต้องซื้อลิขสิทธิ์ — เราจึงแสดงเฉพาะราคาหุ้นที่เปิดเผยต่อสาธารณะ แทนที่จะกุตัวเลขขึ้นมา",
    disclaimer:
      "⚠️ ข้อสงวน — หน้านี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน และไม่ใช่การเสนอขาย โฆษณา หรือชักชวนให้ซื้อขายกัญชา การครอบครองและซื้อขายกัญชาในเมียนมาเป็นสิ่งผิดกฎหมาย",
    legalTitle: "🇹🇭 กฎหมายไทย — ข้อกำหนดที่ต้องปฏิบัติ",
    legalThai:
      "• การปลูก — แม้ปลูกในครัวเรือนก็ต้องจดแจ้งกับ อย.\n• การจำหน่าย — ต้องมีใบอนุญาตจากกรมการแพทย์แผนไทยและการแพทย์ทางเลือก (DTAM)\n• สารสกัดที่มี THC เกิน 0.2% ยังเป็นยาเสพติดที่ควบคุม\n• ห้ามจำหน่ายให้ผู้มีอายุต่ำกว่า 20 ปี หญิงตั้งครรภ์ และหญิงให้นมบุตร\n• ห้ามโฆษณาหรือส่งเสริมการใช้เพื่อสันทนาการ และการสูบในที่สาธารณะมีโทษตาม พ.ร.บ. การสาธารณสุข\n• ปี 2568 มีประกาศให้ต้องมีใบสั่งแพทย์ในการซื้อ — กฎระเบียบเปลี่ยนแปลงต่อเนื่อง โปรดตรวจสอบกับหน่วยงานราชการก่อนดำเนินการ",
    updated: "อัปเดตล่าสุด",
    refresh: "รีเฟรช",
    logTitle: "🇹🇭 บันทึกราคาไทย (บันทึกด้วยมือ — ร้าน / ขายส่ง)",
    logEmpty:
      "ยังไม่มีบันทึก — ราคาช่อดอกไทยไม่มีในตลาดกลาง ผู้ดูแลจึงบันทึกไว้ที่นี่พร้อมเกรด พื้นที่ และวันที่",
    logAdd: "+ เพิ่มราคา",
    logClose: "ปิด",
    logSave: "บันทึก",
    logSaving: "กำลังบันทึก…",
    logDisclaimer:
      "ราคาเหล่านี้บันทึกด้วยมือเพื่อใช้อ้างอิง ไม่ใช่ราคาตลาดกลาง — โปรดดูวันที่ และไม่ใช่การเสนอซื้อขาย",
    formErr: "กรอกชื่อ ราคา และพื้นที่",
    phName: "สินค้า (เช่น ช่อดอกอินดอร์)",
    phGrade: "เกรด (เช่น top shelf / smalls / trim)",
    phPrice: "ราคา",
    phMarket: "พื้นที่ / ตลาด (เช่น กรุงเทพฯ)",
    phNote: "หมายเหตุ (ไม่บังคับ)",
  },
};

/** Quick-picks for the Thai log — what a grower there actually records. */
export const THAI_PRODUCTS: {
  key: string;
  my: string;
  en: string;
  th: string;
}[] = [
  { key: "flower_indoor", my: "Indoor အပွင့်", en: "Indoor flower", th: "ช่อดอกอินดอร์" },
  { key: "flower_greenhouse", my: "Greenhouse အပွင့်", en: "Greenhouse flower", th: "ช่อดอกกรีนเฮาส์" },
  { key: "flower_outdoor", my: "Outdoor အပွင့်", en: "Outdoor flower", th: "ช่อดอกเอาต์ดอร์" },
  { key: "smalls", my: "Smalls (B grade)", en: "Smalls / B-grade", th: "ดอกเล็ก / เกรดบี" },
  { key: "trim", my: "Trim (အရွက်)", en: "Trim", th: "ใบตัดแต่ง (trim)" },
  { key: "hash", my: "Hash / Rosin", en: "Hash / rosin", th: "แฮช / โรซิน" },
  { key: "clone", my: "ပင်ပေါက် / မျိုးပင်", en: "Clones / seedlings", th: "ต้นกล้า / โคลน" },
];

export const THAI_MARKETS: { my: string; en: string; th: string }[] = [
  { my: "ဘန်ကောက်", en: "Bangkok", th: "กรุงเทพฯ" },
  { my: "ချင်းမိုင်", en: "Chiang Mai", th: "เชียงใหม่" },
  { my: "ဖူးခက်", en: "Phuket", th: "ภูเก็ต" },
  { my: "ပတ္တရား", en: "Pattaya", th: "พัทยา" },
  { my: "အီးဆန်း", en: "Isaan", th: "อีสาน" },
  { my: "လက်ကား", en: "Wholesale", th: "ขายส่ง" },
];

export const THAI_UNITS = ["gram", "kg", "lb"];
