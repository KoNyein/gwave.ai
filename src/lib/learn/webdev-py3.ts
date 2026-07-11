// Python course — third batch, taking it from 30 to 60 lessons. Practical,
// real-world Python for Myanmar learners: files, data, the standard library,
// testing, and small automation/agri projects. Reading lessons with short
// Burmese sections. Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

function rd(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  sections: [string, string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "reading",
    sections: sections.map(([heading, body]) => ({ heading, body })),
  };
}

export const PY_EXTRA3: Lesson[] = [
  rd(
    "py-files-read",
    "ဖိုင်ဖတ်ခြင်း (File Reading)",
    "text ဖိုင်များကို Python နဲ့ ဖတ်နည်း — open, read, with။",
    9,
    [
      ["open() နဲ့ ဖွင့်ခြင်း", "`open(\"data.txt\", \"r\")` က ဖိုင်ကို ဖတ်ဖို့ (read mode \"r\") ဖွင့်ပေးသည်။ ပြန်ရလာတဲ့ file object ကို `.read()` နဲ့ တစ်ခါတည်း အကုန်ဖတ်၊ `.readlines()` နဲ့ စာကြောင်း list အဖြစ် ဖတ်နိုင်သည်။"],
      ["with block သုံးပါ", "`with open(\"data.txt\") as f:` ပုံစံက ဖိုင်ကို အလိုအလျောက် ပိတ်ပေးသည် — error တက်လည်း ပိတ်ပေးလို့ လုံခြုံသည်။ `f.close()` ကို ကိုယ်တိုင် မမေ့ရတော့ပါ။"],
      ["စာကြောင်းလိုက် loop", "`for line in f:` က ဖိုင်ကြီးကိုတောင် memory မပြည့်ဘဲ တစ်ကြောင်းချင်း ဖတ်ပေးသည်။ sensor log ကြီးများ ဖတ်ရာမှာ ဒီနည်းက အကောင်းဆုံး။"],
    ],
  ),
  rd(
    "py-files-write",
    "ဖိုင်ရေးခြင်း (File Writing)",
    "data ကို ဖိုင်ထဲ သိမ်းနည်း — write mode, append mode။",
    9,
    [
      ["write vs append", "`\"w\"` mode က ဖိုင်ဟောင်းကို ဖျက်ပြီး အသစ်ရေးသည်။ `\"a\"` (append) က အဆုံးမှာ ဆက်ထည့်ပေးသည် — log မှတ်တမ်းများ ဆက်သိမ်းရာမှာ append သုံးပါ။"],
      ["f.write()", "`f.write(\"မင်္ဂလာပါ\\n\")` — `write()` က newline ကို အလိုအလျောက် မထည့်ပေးလို့ `\\n` ကို ကိုယ်တိုင် ထည့်ရသည်။"],
      ["အသုံးချ", "ရိတ်သိမ်းမှု မှတ်တမ်းကို နေ့စဉ် append လုပ်၍ ဖိုင်တစ်ခုတည်းမှာ စုဆောင်းပြီး နောက်ပိုင်း စာရင်းချုပ် ဆွဲနိုင်သည်။"],
    ],
  ),
  rd(
    "py-json",
    "JSON နဲ့ အလုပ်လုပ်ခြင်း",
    "data ကို JSON အဖြစ် သိမ်း/ဖတ် — json module။",
    9,
    [
      ["JSON ဆိုတာ", "JSON က key–value data ကို text အဖြစ် ဖော်ပြတဲ့ format — API များ၊ config ဖိုင်များ အားလုံးနီးပါး JSON သုံးသည်။ Python dict နဲ့ တူသည်။"],
      ["dumps / loads", "`json.dumps(data)` က dict ကို JSON string ဖြစ်စေသည်။ `json.loads(text)` က ပြန်ပြောင်းသည်။ ဖိုင်အတွက် `json.dump(data, f)` နဲ့ `json.load(f)` သုံးပါ။"],
      ["Myanmar စာ", "`json.dumps(data, ensure_ascii=False)` သုံးမှ မြန်မာစာက `\\u...` မဖြစ်ဘဲ မူရင်းအတိုင်း ကျန်သည်။"],
    ],
  ),
  rd(
    "py-csv",
    "CSV ဖိုင်များ",
    "spreadsheet data ကို ဖတ်/ရေး — csv module။",
    9,
    [
      ["CSV ဆိုတာ", "Comma-Separated Values — Excel/Google Sheets export လုပ်ရင် ရတဲ့ ရိုးရှင်းတဲ့ table format။ တစ်ကြောင်းက row တစ်ခု၊ comma နဲ့ column ခွဲသည်။"],
      ["csv.reader / DictReader", "`csv.reader(f)` က row တစ်ခုကို list အဖြစ် ပေးသည်။ `csv.DictReader(f)` က column ခေါင်းစဉ်နဲ့ dict အဖြစ် ပေးလို့ ပိုဖတ်ရလွယ်သည်။"],
      ["အသုံးချ", "POS အရောင်းစာရင်းကို CSV ဖတ်ပြီး တစ်လစာ ဝင်ငွေ ပေါင်းတွက်တာမျိုး လုပ်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-exceptions-deep",
    "Exception ကိုင်တွယ်ခြင်း (နက်နက်)",
    "try/except/else/finally နဲ့ error များကို ကျွမ်းကျင်စွာ ကိုင်တွယ်ခြင်း။",
    10,
    [
      ["try / except", "အမှားဖြစ်နိုင်တဲ့ code ကို `try:` ထဲ ထည့်ပြီး `except ValueError:` နဲ့ သတ်မှတ်ထားတဲ့ error အမျိုးအစားကို ဖမ်းပါ။ ကိုက်ညီရင် program မ crash ဘဲ ဆက်လုပ်နိုင်သည်။"],
      ["else နဲ့ finally", "`else:` က error မတက်မှသာ run သည်။ `finally:` က တက်သည်ဖြစ်စေ မတက်သည်ဖြစ်စေ အမြဲ run သည် — ဖိုင်ပိတ်၊ connection ဖြုတ်ဖို့ သင့်တော်သည်။"],
      ["raise", "ကိုယ်တိုင် error ဖြစ်စေချင်ရင် `raise ValueError(\"အသက် အနုတ်မဖြစ်ရ\")` သုံးပါ — မမှန်တဲ့ input ကို စောစော ပိတ်ပင်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-datetime",
    "ရက်စွဲနဲ့ အချိန် (datetime)",
    "date, time, timedelta နဲ့ အချိန်တွက်ချက်ခြင်း။",
    10,
    [
      ["datetime object", "`from datetime import datetime` ပြီး `datetime.now()` က လက်ရှိ ရက်စွဲ/အချိန်ကို ပေးသည်။ `.year`, `.month`, `.day` စသဖြင့် အစိတ်အပိုင်း ယူနိုင်သည်။"],
      ["format ပြောင်းခြင်း", "`dt.strftime(\"%Y-%m-%d\")` က အချိန်ကို စာသားအဖြစ်၊ `datetime.strptime(\"2026-07-11\", \"%Y-%m-%d\")` က စာသားကို အချိန်အဖြစ် ပြောင်းသည်။"],
      ["timedelta", "`from datetime import timedelta` သုံးပြီး `dt + timedelta(days=90)` က ရက် ၉၀ ပေါင်းသည် — စိုက်ပျိုးရိတ်သိမ်း ရက်တွက်ရာမှာ အသုံးဝင်သည်။"],
    ],
  ),
  rd(
    "py-regex",
    "Regular Expressions (re)",
    "စာသား pattern ရှာ/စစ်ဆေးခြင်း — re module။",
    11,
    [
      ["pattern ဆိုတာ", "Regex က စာသားပုံစံကို ဖော်ပြတဲ့ ဘာသာစကား။ ဥပမာ `\\d+` က ဂဏန်းတစ်လုံး သို့ ပိုကို ဆိုလိုသည်။ phone၊ email စစ်ရာမှာ သုံးသည်။"],
      ["search နဲ့ findall", "`re.search(pattern, text)` က ပထမဆုံး တွေ့တာကို ပြန်ပေးသည်။ `re.findall(pattern, text)` က တွေ့သမျှ အားလုံးကို list အဖြစ် ပေးသည်။"],
      ["သတိ", "Regex က အားကောင်းပေမဲ့ ရှုပ်လွယ်သည်။ ရိုးရှင်းတဲ့ အလုပ်တွေအတွက် `str` method (`.startswith`, `in`) ကို ဦးစားပေးပါ။"],
    ],
  ),
  rd(
    "py-comprehension-advanced",
    "Comprehension (အဆင့်မြင့်)",
    "nested, conditional comprehension နဲ့ dict/set comprehension။",
    9,
    [
      ["condition ပါ", "`[x for x in nums if x > 0]` က အပြုသဘော ဂဏန်းများသာ ယူသည်။ `if/else` ကို ရှေ့မှာ ထားနိုင်သည်: `[\"+\" if x>0 else \"-\" for x in nums]`။"],
      ["dict comprehension", "`{k: v*2 for k, v in prices.items()}` က ဈေးနှုန်းများကို နှစ်ဆ တွက်ပြီး dict အသစ်ဖန်တီးသည်။"],
      ["ဖတ်ရလွယ်အောင်", "comprehension က တိုတောင်းပေမဲ့ အလွန်ရှုပ်ရင် ရိုးရိုး for loop က ပိုကောင်းသည်။ ဖတ်သူ နားလည်လွယ်တာ အဓိက။"],
    ],
  ),
  rd(
    "py-itertools",
    "itertools module",
    "loop/iterator tools — count, cycle, combinations။",
    9,
    [
      ["ဘာအတွက်လဲ", "itertools က iterator များနဲ့ အလုပ်လုပ်ဖို့ အသင့်သုံး tool များ ပေးသည် — မြန်ဆန်ပြီး memory သက်သာသည်။"],
      ["အသုံးများသည်များ", "`chain(a, b)` က list နှစ်ခုကို ဆက်၊ `combinations(items, 2)` က အတွဲများ ထုတ်၊ `groupby()` က အုပ်စုဖွဲ့ပေးသည်။"],
      ["ဥပမာ", "အပင်မျိုး ၅ မျိုးထဲက ၂ မျိုးတွဲ စမ်းသပ်မယ့် အတွဲအားလုံးကို `combinations` နဲ့ လွယ်လွယ် ရှာနိုင်သည်။"],
    ],
  ),
  rd(
    "py-functools",
    "functools module",
    "reduce, lru_cache, partial — function tools။",
    9,
    [
      ["lru_cache", "`@lru_cache` decorator က function ရဲ့ ရလဒ်ကို မှတ်ထားပေးသည် — တူညီတဲ့ input ကို ထပ်ခေါ်ရင် ချက်ချင်း ပြန်ပေးလို့ မြန်သည်။"],
      ["reduce", "`reduce(lambda a, b: a+b, nums)` က list တစ်ခုလုံးကို တန်ဖိုးတစ်ခုအဖြစ် စုချုံ့သည် — sum နဲ့ဆင်ပေမဲ့ ကိုယ်ပိုင် logic ထည့်နိုင်သည်။"],
      ["partial", "`partial(func, arg1)` က function တစ်ခုရဲ့ argument အချို့ကို ကြိုသတ်မှတ်ထားတဲ့ function အသစ် ဖန်တီးပေးသည်။"],
    ],
  ),
  rd(
    "py-context-managers",
    "Context Managers (with)",
    "with statement ဘယ်လိုအလုပ်လုပ်လဲ — ကိုယ်ပိုင်ဖန်တီးခြင်း။",
    10,
    [
      ["with ရဲ့ အလုပ်", "`with` က resource တစ်ခုကို ဖွင့်၊ သုံး၊ ပိတ် — အဆင့်သုံးဆင့်ကို အာမခံပေးသည်။ ဖိုင်၊ database connection၊ lock များအတွက် အသုံးဝင်သည်။"],
      ["contextmanager", "`from contextlib import contextmanager` ပြီး generator function ကို decorator တပ်၍ ကိုယ်ပိုင် context manager လွယ်လွယ် ဖန်တီးနိုင်သည်။"],
      ["အကျိုး", "resource ကို မမေ့ဘဲ အမြဲ သန့်ရှင်းစွာ ပိတ်ပေးလို့ memory leak နဲ့ ဖိုင် lock ပြဿနာများ လျော့သည်။"],
    ],
  ),
  rd(
    "py-type-hints",
    "Type Hints",
    "code ကို ရှင်းလင်း/လုံခြုံစေမယ့် type annotation။",
    9,
    [
      ["annotation", "`def area(w: float, h: float) -> float:` — parameter နဲ့ return ရဲ့ type ကို ဖော်ပြသည်။ Python က မတားပေမဲ့ editor က အမှားများ ကြိုပြသည်။"],
      ["ရှုပ်ထွေးတာများ", "`list[int]`, `dict[str, float]`, `str | None` စသဖြင့် ရေးနိုင်သည်။ ဒါက code ကြီးလာရင် ဖတ်ရ/ပြင်ရ လွယ်စေသည်။"],
      ["mypy", "`mypy` tool က type အမှားများ run မလုပ်ခင် ရှာဖွေပေးသည် — team နဲ့ project ကြီးများအတွက် အထူးအသုံးဝင်သည်။"],
    ],
  ),
  rd(
    "py-dataclasses",
    "Dataclasses",
    "data သိမ်းဖို့ class များကို လွယ်လွယ် ဖန်တီးခြင်း။",
    9,
    [
      ["@dataclass", "`@dataclass` decorator တပ်လိုက်ရုံနဲ့ `__init__`, `__repr__`, `__eq__` များကို အလိုအလျောက် ရေးပေးသည် — boilerplate မလိုတော့ပါ။"],
      ["field များ", "`@dataclass\\nclass Plant:\\n    name: str\\n    days: int = 90` — default တန်ဖိုးလည်း ထည့်နိုင်သည်။"],
      ["ဘယ်အခါသုံး", "data အများကြီး သိမ်းတဲ့ object (ဥပမာ Sensor reading, Product) များအတွက် ရိုးရိုး class ထက် dataclass က ပိုသန့်သည်။"],
    ],
  ),
  rd(
    "py-enum",
    "Enum",
    "သတ်မှတ်ထားတဲ့ တန်ဖိုးအစုကို ကိုယ်စားပြုခြင်း။",
    8,
    [
      ["Enum ဆိုတာ", "ရွေးစရာ အနည်းငယ်သာ ရှိတဲ့ တန်ဖိုးများ (ဥပမာ status: pending/active/done) ကို ကိန်းသေအဖြစ် သတ်မှတ်ပေးသည်။ စာလုံးမှားတာမျိုး လျော့စေသည်။"],
      ["ရေးနည်း", "`from enum import Enum` ပြီး `class Status(Enum):\\n    PENDING = \"pending\"` — `Status.PENDING.value` နဲ့ တန်ဖိုး ယူသည်။"],
      ["အကျိုး", "code တစ်နေရာမှာ ပြင်ရင် အားလုံး လိုက်ပြောင်းသည်။ magic string များ ပြန့်ကျဲနေတာထက် စီမံရ လွယ်သည်။"],
    ],
  ),
  rd(
    "py-virtualenv",
    "Virtual Environment နဲ့ pip",
    "project တစ်ခုစီအတွက် သီးသန့် package ပတ်ဝန်းကျင်။",
    9,
    [
      ["ဘာကြောင့်လိုလဲ", "project မတူရင် package version မတူနိုင်သည်။ virtual environment က project တစ်ခုစီအတွက် သီးခြား package အစု ထားပေးလို့ တစ်ခုနဲ့တစ်ခု မထိခိုက်ပါ။"],
      ["ဖန်တီး/သုံး", "`python -m venv venv` က ဖန်တီး၊ `source venv/bin/activate` (Windows: `venv\\Scripts\\activate`) က ဝင်သည်။"],
      ["pip", "`pip install requests` က package ထည့်၊ `pip freeze > requirements.txt` က သုံးထားသမျှ စာရင်း သိမ်းသည် — အခြားသူ ပြန်တပ်နိုင်စေဖို့။"],
    ],
  ),
  rd(
    "py-requests",
    "Internet မှ data ယူခြင်း (requests)",
    "HTTP request နဲ့ API/website မှ data ဆွဲယူခြင်း။",
    10,
    [
      ["requests library", "`import requests` ပြီး `requests.get(url)` က website/API ကို ခေါ်ဆိုပြီး response ပြန်ရသည်။ pip နဲ့ ကြိုတပ်ရသည်။"],
      ["response ဖတ်ခြင်း", "`r.status_code` က အောင်မြင်မှု (200 = OK)၊ `r.json()` က JSON data ကို dict အဖြစ် ပြောင်းပေးသည်။"],
      ["ဥပမာ", "ရာသီဥတု API ကို ခေါ်ပြီး မိုးရွာနိုင်ခြေကို ဖမ်းယူ၍ ရေလောင်းသင့်/မသင့် ဆုံးဖြတ်တဲ့ script ရေးနိုင်သည်။"],
    ],
  ),
  rd(
    "py-scraping-basics",
    "Web Scraping အခြေခံ",
    "website မှ အချက်အလက် ကောက်ယူခြင်း — BeautifulSoup။",
    10,
    [
      ["HTML ဖတ်ခြင်း", "`requests` နဲ့ စာမျက်နှာ HTML ကို ဆွဲပြီး `BeautifulSoup(html, \"html.parser\")` နဲ့ tag များထဲက data ကို ရွေးထုတ်သည်။"],
      ["ရွေးထုတ်ခြင်း", "`soup.find_all(\"h2\")` က h2 အားလုံး၊ `.text` က အထဲက စာသား ယူသည်။ CSS selector `soup.select(\".price\")` လည်း သုံးနိုင်သည်။"],
      ["ကျင့်ဝတ်", "website ရဲ့ စည်းကမ်း (robots.txt) ကို လိုက်နာပါ။ အလွန်အကျွံ ခေါ်ဆိုခြင်း (spam) ကို ရှောင်၍ တာဝန်သိသိ သုံးပါ။"],
    ],
  ),
  rd(
    "py-sqlite",
    "SQLite Database",
    "Python ထဲမှာ တိုက်ရိုက် database သုံးခြင်း — sqlite3။",
    10,
    [
      ["built-in database", "`import sqlite3` က Python မှာ ပါပြီးသား — ဖိုင်တစ်ခုတည်းနဲ့ database တစ်ခုလုံး ရသည်။ install စရာ မလို။"],
      ["query run", "`conn = sqlite3.connect(\"shop.db\")` ပြီး `conn.execute(\"SELECT * FROM sales\")` နဲ့ query run သည်။ ပြင်ဆင်ပြီးရင် `conn.commit()` လုပ်ပါ။"],
      ["parameter", "`execute(\"INSERT INTO x VALUES (?)\", (val,))` — `?` placeholder သုံးပါ။ string ပေါင်းတာက SQL injection အန္တရာယ် ရှိသည်။"],
    ],
  ),
  rd(
    "py-argparse",
    "Command-Line App (argparse)",
    "terminal မှ argument လက်ခံတဲ့ program ရေးခြင်း။",
    9,
    [
      ["CLI ဆိုတာ", "`python water.py --plant tomato --days 90` လို terminal ကနေ တိုက်ရိုက် သုံးလို့ရတဲ့ program။ automation အတွက် အသုံးဝင်သည်။"],
      ["argparse", "`import argparse` ပြီး `parser.add_argument(\"--days\", type=int)` နဲ့ လက်ခံမယ့် argument သတ်မှတ်သည်။ `args.days` နဲ့ ယူသည်။"],
      ["အကျိုး", "help message၊ type စစ်ဆေးမှုကို အလိုအလျောက် ပေးလို့ professional CLI tool လွယ်လွယ် ဆောက်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-logging",
    "Logging",
    "program ရဲ့ အဖြစ်အပျက်ကို print ထက်ကောင်းစွာ မှတ်တမ်းတင်ခြင်း။",
    9,
    [
      ["print ထက်ဘာကြောင့်ကောင်း", "`logging` က message တွေကို အဆင့် (DEBUG/INFO/WARNING/ERROR) ခွဲ၊ အချိန်တံဆိပ် ထည့်၊ ဖိုင်ထဲ သိမ်းပေးနိုင်သည် — print နဲ့ မရနိုင်တာတွေ။"],
      ["အသုံးပြုနည်း", "`import logging` ပြီး `logging.basicConfig(level=logging.INFO)`၊ ပြီးရင် `logging.info(\"sensor connected\")` စသဖြင့် ခေါ်သည်။"],
      ["ဘာအခါသုံး", "server၊ automation script၊ ကြာရှည် run တဲ့ program များအတွက် ပြဿနာ ရှာဖွေရာမှာ log က မရှိမဖြစ်။"],
    ],
  ),
  rd(
    "py-testing",
    "Testing (unittest / pytest)",
    "code မှန်/မမှန် အလိုအလျောက် စစ်ဆေးခြင်း။",
    10,
    [
      ["ဘာကြောင့် test", "code ပြင်တိုင်း ဟောင်းတာတွေ ကျိုးမကျိုး လက်နဲ့ စစ်ရတာ ပင်ပန်းသည်။ test က တစ်ချက်နှိပ်ရုံနဲ့ အားလုံးကို အလိုအလျောက် စစ်ပေးသည်။"],
      ["assert", "test ရဲ့ အနှစ်သာရက `assert add(2, 3) == 5` — မမှန်ရင် test fail ပြသည်။ pytest က ဒီ assert များကို စုပြီး report ပေးသည်။"],
      ["pytest", "`pip install pytest` ပြီး `test_` နဲ့စတဲ့ function များ ရေး၊ `pytest` command run ရုံ။ လွယ်ကူပြီး လူသုံးများသည်။"],
    ],
  ),
  rd(
    "py-os-paths",
    "ဖိုင်စနစ်နဲ့ အလုပ်လုပ်ခြင်း (os, pathlib)",
    "folder, path, ဖိုင်စာရင်းများ စီမံခြင်း။",
    9,
    [
      ["pathlib", "`from pathlib import Path` ပြီး `Path(\"data\") / \"log.txt\"` က path များကို လွယ်လွယ် တွဲပေးသည် — OS မတူလည်း အဆင်ပြေသည်။"],
      ["အသုံးများ", "`p.exists()` က ရှိ/မရှိ၊ `p.glob(\"*.csv\")` က csv ဖိုင်အားလုံး ရှာ၊ `p.mkdir()` က folder ဖန်တီးသည်။"],
      ["ဥပမာ", "folder ထဲက ဓာတ်ပုံဖိုင် အားလုံးကို glob နဲ့ ရှာပြီး တစ်ခုချင်း အမည်ပြောင်း/ပြင်ဆင် လုပ်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-numpy-intro",
    "NumPy မိတ်ဆက်",
    "ကိန်းဂဏန်း array များကို မြန်ဆန်စွာ တွက်ချက်ခြင်း။",
    10,
    [
      ["array", "NumPy array က list နဲ့ ဆင်ပေမဲ့ ကိန်းဂဏန်း တွက်ချက်မှုမှာ အဆများစွာ မြန်သည်။ data science၊ AI အားလုံး NumPy အပေါ် တည်သည်။"],
      ["vectorize", "`arr * 2` က element အားလုံးကို တစ်ပြိုင်တည်း နှစ်ဆ တွက်သည် — loop မလိုတော့ပါ။ `arr.mean()`, `arr.sum()` စသဖြင့် လွယ်လွယ် တွက်နိုင်သည်။"],
      ["ဥပမာ", "sensor reading ၁၀၀၀ ခုရဲ့ ပျမ်းမျှ/အမြင့်ဆုံး/စံသွေဖည်ကို NumPy နဲ့ တစ်ကြောင်းတည်း တွက်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-pandas-intro",
    "Pandas မိတ်ဆက်",
    "table data ကို ခွဲခြမ်းစိတ်ဖြာခြင်း — DataFrame။",
    11,
    [
      ["DataFrame", "Pandas DataFrame က Python ထဲက Excel table လိုပဲ — row, column နဲ့ data ကို စီမံသည်။ data analysis အတွက် အသုံးအများဆုံး tool။"],
      ["ဖတ်/စစ်ထုတ်", "`df = pd.read_csv(\"sales.csv\")` က CSV ဖတ်၊ `df[df[\"amount\"] > 1000]` က စစ်ထုတ်၊ `df.groupby(\"product\").sum()` က အုပ်စုဖွဲ့ ပေါင်းသည်။"],
      ["ဥပမာ", "POS အရောင်းစာရင်းကို ဖတ်ပြီး ကုန်ပစ္စည်းတစ်ခုစီ ဘယ်လောက် ရောင်းရလဲ ချက်ချင်း ချုပ်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-matplotlib-intro",
    "Matplotlib နဲ့ Chart ဆွဲခြင်း",
    "data ကို graph/chart အဖြစ် မြင်သာအောင် ပြသခြင်း။",
    9,
    [
      ["plot", "`import matplotlib.pyplot as plt` ပြီး `plt.plot(x, y)` က line chart၊ `plt.bar(...)` က bar chart ဆွဲသည်။ `plt.show()` နဲ့ ပြသည်။"],
      ["တန်ဆာဆင်", "`plt.title()`, `plt.xlabel()`, `plt.ylabel()` နဲ့ ခေါင်းစဉ်/label ထည့်ပါ။ `plt.savefig(\"chart.png\")` က ဓာတ်ပုံအဖြစ် သိမ်းသည်။"],
      ["ဥပမာ", "အပူချိန် sensor data ကို တစ်ရက်စာ line chart ဆွဲပြီး ဘယ်အချိန် အပူဆုံးလဲ မြင်သာစေနိုင်သည်။"],
    ],
  ),
  rd(
    "py-scope-closures",
    "Scope နဲ့ Closure",
    "variable ဘယ်နေရာမှာ အသက်ဝင်လဲ — LEGB, closure။",
    10,
    [
      ["LEGB rule", "Python က variable ကို Local → Enclosing → Global → Built-in အစဉ်လိုက် ရှာသည်။ function ထဲက variable က ပြင်ပ variable ကို ဖုံးဖို့ (shadow) ဖြစ်နိုင်သည်။"],
      ["global / nonlocal", "function ထဲက ပြင်ပ variable ကို ပြောင်းချင်ရင် `global x` သို့ `nonlocal x` ကြေညာရသည် — မဟုတ်ရင် local အသစ် ဖြစ်သွားသည်။"],
      ["closure", "function တစ်ခုက အဖွဲ့ဝင် variable ကို \"မှတ်\" ထားပြီး ပြန်ပေးတဲ့ function — configuration ကို ချုပ်ကိုင်ထားတဲ့ helper များ ဖန်တီးရာမှာ သုံးသည်။"],
    ],
  ),
  rd(
    "py-async-intro",
    "Async မိတ်ဆက်",
    "အလုပ်များစွာကို တစ်ပြိုင်နက် စောင့်ဆိုင်းစီမံခြင်း။",
    10,
    [
      ["ဘာကြောင့်လိုလဲ", "internet မှ data ဆွဲတာမျိုး \"စောင့်ရတဲ့\" အလုပ်များ အများကြီး ရှိရင် တစ်ခုပြီးမှ တစ်ခု စောင့်တာက နှေးသည်။ async က တစ်ပြိုင်နက် စောင့်ပေးသည်။"],
      ["async / await", "`async def fetch():` နဲ့ ကြေညာ၊ `await requests_call()` နဲ့ စောင့်ပါ။ `asyncio.run(main())` က စတင်သည်။"],
      ["သတိ", "CPU အလုပ်ကြမ်း (တွက်ချက်မှုများ) အတွက် async မကူညီပါ — network/ဖိုင် စောင့်ဆိုင်းမှုများအတွက်သာ သင့်တော်သည်။"],
    ],
  ),
  rd(
    "py-project-harvest",
    "Project — ရိတ်သိမ်း တွက်စက်",
    "သင်ယူထားသမျှ ပေါင်းစပ်၍ CLI harvest calculator ဆောက်ခြင်း။",
    12,
    [
      ["ဒီဇိုင်း", "input — အပင်အမည်၊ စိုက်ရက်၊ ဧရိယာ။ output — ရိတ်သိမ်းရက်၊ ခန့်မှန်း အထွက်နှုန်း။ dict/function/datetime ပေါင်းသုံးသည်။"],
      ["အဆင့်များ", "argparse နဲ့ input ယူ → datetime နဲ့ ရိတ်ရက် တွက် → dict ထဲက အထွက်နှုန်း ရှာ → ရလဒ် print/CSV သိမ်း။"],
      ["တိုးချဲ့", "CSV ဖိုင်ထဲ မှတ်တမ်း append လုပ်ပြီး ရာသီအလိုက် ချုပ်ချက်ကို pandas နဲ့ ဆွဲ၍ ကိုယ်ပိုင် စိုက်ခင်း dashboard အထိ ဆက်တည်ဆောက်နိုင်သည်။"],
    ],
  ),
  rd(
    "py-good-style",
    "သန့်ရှင်းသော Code (PEP 8)",
    "ဖတ်ရလွယ်၊ ပြင်ရလွယ်တဲ့ Python ရေးထုံး။",
    9,
    [
      ["PEP 8", "Python ရဲ့ တရားဝင် ရေးထုံးလမ်းညွှန်။ ကွက်လပ် ၄ လုံး indent၊ variable ကို `snake_case`၊ class ကို `PascalCase`၊ constant ကို `UPPER_CASE`။"],
      ["နာမည်ကောင်း", "`x`, `data` ထက် `harvest_days`, `plant_count` လို ဆိုလိုရင်း ရှင်းတဲ့ နာမည်များက code ကို ကိုယ်တိုင်ပြန်ဖတ်ရင် နားလည်လွယ်စေသည်။"],
      ["tool", "`black` က code ကို အလိုအလျောက် သပ်ရပ်စွာ format လုပ်၊ `ruff`/`flake8` က ရေးထုံးအမှားများ ထောက်ပြသည် — အလေ့အထ ကောင်းအောင် ကူညီသည်။"],
    ],
  ),
];
