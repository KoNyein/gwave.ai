// Python course — third batch (30 → 60), rebuilt to full quality: every lesson
// is a *runnable* Pyodide playground lesson (kind "python" + pythonCode), has a
// YouTube video hint, and detailed Burmese explanations with real code samples
// in each section. Practical, real-world Python with agri/Myanmar context.
// Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

/** Build a runnable Python lesson: video + playground starter + rich sections. */
function py(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  pythonCode: string,
  sections: [heading: string, body: string, code?: string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "python",
    youtubeQuery,
    pythonCode,
    sections: sections.map(([heading, body, code]) =>
      code ? { heading, body, code } : { heading, body },
    ),
  };
}

export const PY_EXTRA3: Lesson[] = [
  py(
    "py-files-read",
    "ဖိုင်ဖတ်ခြင်း (File Reading)",
    "text ဖိုင်များကို open, read, with block နဲ့ ဖတ်နည်း။",
    10,
    "python read text file tutorial",
    '# Pyodide ရဲ့ virtual disk မှာ ဖိုင်တစ်ခု ဆောက်ကြည့်ရအောင်\nwith open("farm.txt", "w") as f:\n    f.write("tomato\\ncucumber\\nchili\\n")\n\n# အခု ပြန်ဖတ်မယ်\nwith open("farm.txt", "r") as f:\n    content = f.read()\nprint(content)\n\n# စာကြောင်းလိုက် ဖတ်ခြင်း\nwith open("farm.txt") as f:\n    for i, line in enumerate(f, 1):\n        print(i, "->", line.strip())',
    [
      [
        "open() နဲ့ mode",
        "ဖိုင်တစ်ခုကို သုံးဖို့ `open(path, mode)` နဲ့ ဖွင့်ရသည်။ mode `\"r\"` က ဖတ်ရန် (read)၊ `\"w\"` က ရေးရန်၊ `\"a\"` က ဆက်ထည့်ရန်။ ပြန်ရလာတဲ့ file object ကို `.read()` (အကုန်တစ်ခါတည်း)၊ `.readline()` (တစ်ကြောင်း)၊ သို့မဟုတ် `.readlines()` (list) နဲ့ ဖတ်နိုင်သည်။",
        'f = open("farm.txt", "r")\ntext = f.read()\nf.close()   # ကိုယ်တိုင် ပိတ်ရသည်',
      ],
      [
        "with block — အကောင်းဆုံးနည်း",
        "`with open(...) as f:` ပုံစံက အလုပ်ပြီးတာနဲ့ ဖိုင်ကို အလိုအလျောက် ပိတ်ပေးသည် — error တက်လည်း ပိတ်ပေးလို့ `f.close()` ကို မမေ့ရတော့ပါ။ ဒါကြောင့် ဖိုင်နဲ့ အလုပ်လုပ်ရင် `with` ကို အမြဲ သုံးသင့်သည်။",
        'with open("farm.txt") as f:\n    text = f.read()\n# ဒီနေရာရောက်ရင် ဖိုင် ပိတ်ပြီးသား',
      ],
      [
        "စာကြောင်းလိုက် loop",
        "ဖိုင်ကြီးများကို `f.read()` နဲ့ အကုန်ဖတ်ရင် memory ပြည့်နိုင်သည်။ `for line in f:` က တစ်ကြောင်းချင်း ဖတ်ပေးလို့ sensor log ကြီးများ ဖတ်ရာမှာ အသင့်တော်ဆုံး။ `.strip()` က အဆုံးက newline (`\\n`) ကို ဖယ်ပေးသည်။",
        'with open("farm.txt") as f:\n    for line in f:\n        print(line.strip())',
      ],
    ],
  ),
  py(
    "py-files-write",
    "ဖိုင်ရေးခြင်း (File Writing)",
    "data ကို write/append mode နဲ့ ဖိုင်ထဲ သိမ်းနည်း။",
    10,
    "python write to file tutorial",
    '# write mode — ဖိုင်ဟောင်းကို ဖျက်ပြီး အသစ်ရေး\nwith open("log.txt", "w") as f:\n    f.write("Day 1: seeds planted\\n")\n    f.write("Day 2: watered\\n")\n\n# append mode — အဆုံးမှာ ဆက်ထည့်\nwith open("log.txt", "a") as f:\n    f.write("Day 3: first sprout!\\n")\n\nwith open("log.txt") as f:\n    print(f.read())',
    [
      [
        "write vs append",
        "`\"w\"` (write) mode က ဖိုင်ဟောင်းရဲ့ အကြောင်းအရာကို အကုန်ဖျက်ပြီး အသစ် ပြန်ရေးသည် — သတိထားပါ။ `\"a\"` (append) mode က ဖိုင်ဟောင်းကို မဖျက်ဘဲ အဆုံးမှာ ဆက်ထည့်ပေးသည်။ log/မှတ်တမ်း ဆက်သိမ်းရာမှာ append ကို သုံးပါ။",
        'with open("log.txt", "a") as f:\n    f.write("new entry\\n")',
      ],
      [
        "newline ကို ကိုယ်တိုင်ထည့်",
        "`f.write()` က `print()` နဲ့မတူ — စာကြောင်းသစ် (`\\n`) ကို အလိုအလျောက် မထည့်ပေးပါ။ ဒါကြောင့် စာကြောင်းခွဲချင်ရင် string အဆုံးမှာ `\\n` ကို ကိုယ်တိုင် ထည့်ရသည်။ list တစ်ခုလုံးကို `f.writelines(lines)` နဲ့လည်း ရေးနိုင်သည်။",
        'rows = ["a\\n", "b\\n", "c\\n"]\nwith open("out.txt", "w") as f:\n    f.writelines(rows)',
      ],
      [
        "အသုံးချ — ရိတ်သိမ်းမှတ်တမ်း",
        "နေ့စဉ် ရိတ်သိမ်းမှုကို append နဲ့ ဖိုင်တစ်ခုတည်းမှာ စုဆောင်းထားနိုင်သည်။ နောက်ပိုင်း ဒီဖိုင်ကို ဖတ်ပြီး တစ်လစာ စာရင်းချုပ် ဆွဲနိုင်သည် — data ကို ဖိုင်မှာ 'ရှင်သန်' နေစေခြင်းက automation ရဲ့ အခြေခံ။",
      ],
    ],
  ),
  py(
    "py-json",
    "JSON နဲ့ အလုပ်လုပ်ခြင်း",
    "data ကို JSON အဖြစ် သိမ်း/ဖတ် — json module။",
    10,
    "python json module tutorial",
    'import json\n\nplant = {"name": "tomato", "days": 90, "organic": True}\n\n# dict -> JSON string\ntext = json.dumps(plant, ensure_ascii=False)\nprint("JSON:", text)\n\n# JSON string -> dict\nback = json.loads(text)\nprint("days:", back["days"])',
    [
      [
        "JSON ဆိုတာ",
        "JSON (JavaScript Object Notation) က key–value data ကို text အဖြစ် ဖော်ပြတဲ့ format တစ်ခု။ API များ၊ config ဖိုင်များ၊ web app အားလုံးနီးပါး JSON ကို သုံးကြသည်။ ပုံစံအရ Python dict နဲ့ အလွန်ဆင်တူသည်။",
        '{"name": "tomato", "days": 90, "organic": true}',
      ],
      [
        "dumps နဲ့ loads",
        "`json.dumps(obj)` က Python object (dict/list) ကို JSON string ဖြစ်စေသည် (dump-string)။ `json.loads(text)` က ပြန်ပြောင်းပေးသည် (load-string)။ ဖိုင်အတွက်တော့ `json.dump(obj, f)` နဲ့ `json.load(f)` ကို သုံးပါ။",
        'with open("plant.json", "w") as f:\n    json.dump(plant, f)\nwith open("plant.json") as f:\n    data = json.load(f)',
      ],
      [
        "မြန်မာစာ ဂရုစိုက်",
        "default အားဖြင့် `dumps` က မြန်မာစာလို ASCII မဟုတ်တဲ့ စာလုံးများကို `\\u...` အဖြစ် ပြောင်းပစ်သည်။ `ensure_ascii=False` ထည့်မှ မူရင်း မြန်မာစာအတိုင်း ကျန်သည်။ လှအောင် format လုပ်ချင်ရင် `indent=2` ထည့်ပါ။",
        'print(json.dumps(plant, ensure_ascii=False, indent=2))',
      ],
    ],
  ),
  py(
    "py-csv",
    "CSV ဖိုင်များ",
    "spreadsheet data ကို csv module နဲ့ ဖတ်/ရေး။",
    10,
    "python csv module tutorial",
    'import csv, io\n\n# CSV data ကို string အဖြစ် တည်ဆောက် (ဖိုင်အစား)\ndata = "product,qty,price\\ntomato,10,500\\nchili,5,800\\n"\n\nreader = csv.DictReader(io.StringIO(data))\ntotal = 0\nfor row in reader:\n    line = int(row["qty"]) * int(row["price"])\n    total += line\n    print(row["product"], "->", line, "MMK")\nprint("Total:", total, "MMK")',
    [
      [
        "CSV ဆိုတာ",
        "CSV (Comma-Separated Values) က Excel/Google Sheets ကနေ export လုပ်ရင် ရတဲ့ ရိုးရှင်းတဲ့ table format။ တစ်ကြောင်းက row တစ်ခု၊ comma နဲ့ column တွေ ခွဲသည်။ ပထမကြောင်းက များသောအားဖြင့် column ခေါင်းစဉ် (header)။",
        'product,qty,price\ntomato,10,500\nchili,5,800',
      ],
      [
        "reader နဲ့ DictReader",
        "`csv.reader(f)` က row တစ်ခုကို list (`[\"tomato\", \"10\", \"500\"]`) အဖြစ် ပေးသည်။ `csv.DictReader(f)` က header ကို key အဖြစ်သုံးပြီး dict (`{\"product\": \"tomato\", ...}`) အဖြစ် ပေးလို့ ပိုဖတ်ရလွယ်သည်။",
        'with open("sales.csv") as f:\n    for row in csv.DictReader(f):\n        print(row["product"])',
      ],
      [
        "ရေးခြင်း",
        "`csv.writer(f)` ရဲ့ `.writerow([...])` က row တစ်ကြောင်း ရေးသည်။ POS အရောင်းစာရင်းကို CSV ဖတ်ပြီး တစ်လစာ ဝင်ငွေ ပေါင်းတွက်တာမျိုး၊ report ကို CSV ရေးပြီး Excel မှာ ဖွင့်တာမျိုး လုပ်နိုင်သည်။",
        'with open("out.csv", "w", newline="") as f:\n    w = csv.writer(f)\n    w.writerow(["product", "qty"])\n    w.writerow(["tomato", 10])',
      ],
    ],
  ),
  py(
    "py-exceptions-deep",
    "Exception ကိုင်တွယ်ခြင်း (နက်နက်)",
    "try/except/else/finally နဲ့ error များကို ကျွမ်းကျင်စွာ ကိုင်တွယ်ခြင်း။",
    11,
    "python exception handling tutorial",
    'def safe_divide(a, b):\n    try:\n        result = a / b\n    except ZeroDivisionError:\n        print("သုညနဲ့ မစားနိုင်ပါ")\n        return None\n    else:\n        print("အောင်မြင်")\n        return result\n    finally:\n        print("--- ပြီးဆုံး ---")\n\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))',
    [
      [
        "try / except",
        "အမှားဖြစ်နိုင်တဲ့ code ကို `try:` block ထဲ ထည့်ပြီး `except ErrorType:` နဲ့ သတ်မှတ်ထားတဲ့ error အမျိုးအစားကို ဖမ်းသည်။ ကိုက်ညီရင် program က crash မဖြစ်ဘဲ except block ကို run ပြီး ဆက်လုပ်နိုင်သည်။ error အမျိုးအစား အတိအကျ (ValueError, ZeroDivisionError) ဖမ်းတာက အလုံးစုံ `except:` ထက် ကောင်းသည်။",
        'try:\n    n = int("abc")\nexcept ValueError:\n    print("ဂဏန်း မဟုတ်ပါ")',
      ],
      [
        "else နဲ့ finally",
        "`else:` က try ထဲမှာ error **မတက်မှ**သာ run သည်။ `finally:` က error တက်သည်ဖြစ်စေ မတက်သည်ဖြစ်စေ **အမြဲ** run သည် — ဖိုင်ပိတ်ခြင်း၊ connection ဖြုတ်ခြင်း စတဲ့ သန့်ရှင်းရေး အလုပ်များအတွက် သင့်တော်သည်။",
        'try:\n    f = open("data.txt")\nfinally:\n    f.close()  # အမြဲ ပိတ်',
      ],
      [
        "raise — ကိုယ်တိုင် error ဖြစ်စေ",
        "မမှန်တဲ့ input ကို စောစော ပိတ်ပင်ချင်ရင် `raise ValueError(\"...\")` နဲ့ ကိုယ်တိုင် error ဖြစ်စေနိုင်သည်။ ဒါက bug ကို နောက်ပိုင်း ရှုပ်ရှုပ်ထွေးထွေး ရှာရတာထက် ချက်ချင်း ဖော်ထုတ်ပေးသည်။",
        'def set_age(age):\n    if age < 0:\n        raise ValueError("အသက် အနုတ် မဖြစ်ရ")\n    return age',
      ],
    ],
  ),
  py(
    "py-datetime",
    "ရက်စွဲနဲ့ အချိန် (datetime)",
    "date, time, timedelta နဲ့ အချိန်တွက်ချက်ခြင်း။",
    11,
    "python datetime tutorial",
    'from datetime import datetime, timedelta\n\nplanted = datetime(2026, 1, 1)\nharvest = planted + timedelta(days=90)\n\nprint("စိုက်သည့်ရက်:", planted.strftime("%Y-%m-%d"))\nprint("ရိတ်မည့်ရက်:", harvest.strftime("%Y-%m-%d"))\nprint("ကျန်ရက်:", (harvest - planted).days, "ရက်")',
    [
      [
        "datetime object",
        "`from datetime import datetime` ပြီး `datetime.now()` က လက်ရှိ ရက်စွဲ/အချိန်ကို ပေးသည်။ `datetime(2026, 1, 1)` နဲ့ ရက်စွဲ တိတိကျကျ ဖန်တီးနိုင်သည်။ `.year`, `.month`, `.day`, `.hour` စသဖြင့် အစိတ်အပိုင်း ယူနိုင်သည်။",
        'now = datetime.now()\nprint(now.year, now.month, now.day)',
      ],
      [
        "format ပြောင်းခြင်း",
        "`dt.strftime(\"%Y-%m-%d\")` က datetime ကို စာသားအဖြစ် (format)၊ `datetime.strptime(\"2026-07-11\", \"%Y-%m-%d\")` က စာသားကို datetime အဖြစ် (parse) ပြောင်းသည်။ `%Y` = နှစ်၊ `%m` = လ၊ `%d` = ရက်၊ `%H:%M` = နာရီ:မိနစ်။",
        'text = now.strftime("%d/%m/%Y %H:%M")\nprint(text)',
      ],
      [
        "timedelta — ကာလ တွက်ခြင်း",
        "`timedelta(days=90)` က ကာလ တစ်ခုကို ကိုယ်စားပြုသည်။ datetime နဲ့ ပေါင်း/နုတ် နိုင်သည်။ datetime နှစ်ခု နုတ်ရင် timedelta ရ၊ `.days` နဲ့ ကြာချိန်ကို ရက်အဖြစ် ယူသည် — စိုက်ပျိုးရိတ်သိမ်း ရက်တွက်ရာမှာ အသုံးဝင်။",
        'left = harvest - datetime.now()\nprint(left.days, "ရက် ကျန်")',
      ],
    ],
  ),
  py(
    "py-regex",
    "Regular Expressions (re)",
    "စာသား pattern ရှာ/စစ်ဆေးခြင်း — re module။",
    12,
    "python regex tutorial",
    'import re\n\ntext = "ဆက်သွယ်ရန် 09123456789 သို့ 09987654321"\n\n# ဂဏန်း ၇ လုံးအထက် အားလုံး ရှာ\nphones = re.findall(r"\\d{7,}", text)\nprint("ဖုန်းများ:", phones)\n\n# ပထမဆုံး တွေ့တာ\nm = re.search(r"\\d+", text)\nprint("ပထမဆုံး:", m.group())',
    [
      [
        "pattern ဆိုတာ",
        "Regex (regular expression) က စာသား ပုံစံ (pattern) ကို ဖော်ပြတဲ့ ဘာသာစကားငယ်။ `\\d` = ဂဏန်းတစ်လုံး၊ `\\d+` = ဂဏန်းတစ်လုံး သို့ ပို၊ `\\d{7,}` = ၇ လုံးအထက်၊ `\\w` = စာလုံး/ဂဏန်း၊ `.` = မည်သည့်စာလုံးမဆို။ phone၊ email၊ password format စစ်ရာမှာ သုံးသည်။",
        'r"\\d{7,}"   # ဂဏန်း ၇ လုံးအထက်',
      ],
      [
        "search, findall, match",
        "`re.search(p, s)` က ပထမဆုံး တွေ့တာရဲ့ match object ကို ပြန်ပေး (မတွေ့ရင် `None`)။ `re.findall(p, s)` က တွေ့သမျှ အားလုံးကို list အဖြစ် ပေးသည်။ match object ရဲ့ `.group()` က တွေ့တဲ့ စာသားကို ယူသည်။",
        'if re.search(r"^09\\d{9}$", "09123456789"):\n    print("ဖုန်းနံပါတ် မှန်")',
      ],
      [
        "replace နဲ့ သတိ",
        "`re.sub(p, repl, s)` က pattern နဲ့ ကိုက်တာကို အစားထိုးသည် — ကွက်လပ်များစွာကို တစ်လုံးအဖြစ် ပြောင်းတာမျိုး။ Regex က အားကောင်းပေမဲ့ ရှုပ်လွယ်လို့ ရိုးရှင်းတဲ့ အလုပ်တွေအတွက် `str` method (`.startswith`, `in`) ကို ဦးစားပေးပါ။",
        'clean = re.sub(r"\\s+", " ", "a   b    c")\nprint(clean)  # "a b c"',
      ],
    ],
  ),
  py(
    "py-comprehension-advanced",
    "Comprehension (အဆင့်မြင့်)",
    "conditional, nested, dict/set comprehension။",
    10,
    "python list comprehension advanced",
    'nums = [-3, 5, -1, 8, 0, 12]\n\npos = [x for x in nums if x > 0]\nprint("အပြု:", pos)\n\nsigns = ["+" if x > 0 else "-" if x < 0 else "0" for x in nums]\nprint("သင်္ကေတ:", signs)\n\nprices = {"tomato": 500, "chili": 800}\ndoubled = {k: v * 2 for k, v in prices.items()}\nprint("နှစ်ဆ:", doubled)',
    [
      [
        "condition ထည့်ခြင်း",
        "`[x for x in nums if x > 0]` က စစ်ဆေးမှု (`if`) မှန်တဲ့ element များသာ ယူသည် — filter လုပ်တာ။ `if/else` ကို ရှေ့မှာ ထားရင်တော့ element တိုင်းကို ပြောင်းပေးသည် (map + choose)။",
        '[x * 2 for x in nums if x > 0]',
      ],
      [
        "dict နဲ့ set comprehension",
        "curly bracket `{}` သုံးရင် dict သို့ set comprehension ဖြစ်သည်။ `{k: v*2 for k, v in d.items()}` က dict အသစ်၊ `{x for x in nums}` က ထပ်နေမှုမရှိတဲ့ set ဖန်တီးသည်။",
        'squares = {x: x*x for x in range(1, 5)}\nprint(squares)  # {1:1, 2:4, 3:9, 4:16}',
      ],
      [
        "ဖတ်ရလွယ်အောင် ချိန်ဆ",
        "comprehension က တိုတောင်း၊ မြန်ဆန်ပေမဲ့ အလွန် ရှုပ်ရင် (nested နှစ်ထပ်သုံးထပ်) ရိုးရိုး for loop က ပိုဖတ်ရလွယ်သည်။ code ဆိုတာ 'တိုတာ' ထက် 'နားလည်လွယ်တာ' က ပိုအရေးကြီးသည်။",
      ],
    ],
  ),
  py(
    "py-itertools",
    "itertools module",
    "chain, combinations, groupby — iterator tools။",
    10,
    "python itertools tutorial",
    'from itertools import combinations, chain\n\nplants = ["tomato", "chili", "mint"]\n\n# ၂ မျိုးတွဲ အားလုံး\nfor pair in combinations(plants, 2):\n    print(pair)\n\n# list နှစ်ခု ဆက်\nmerged = list(chain([1, 2], [3, 4]))\nprint("merged:", merged)',
    [
      [
        "ဘာအတွက်လဲ",
        "itertools က iterator များနဲ့ အလုပ်လုပ်ဖို့ အသင့်သုံး tool များ ပေးသည် — C နဲ့ ရေးထားလို့ မြန်ဆန်ပြီး memory သက်သာသည်။ loop နဲ့ ကိုယ်တိုင်ရေးရမယ့် ရှုပ်ထွေးမှုတွေကို လျှော့ပေးသည်။",
      ],
      [
        "အသုံးများသည်များ",
        "`chain(a, b)` က iterable များ ဆက်၊ `combinations(items, 2)` က အတွဲများ ထုတ်၊ `permutations` က အစီအစဉ်များ၊ `groupby` က ဆက်တိုက်တူညီတာများ အုပ်စုဖွဲ့၊ `count`/`cycle` က အဆုံးမရှိ sequence ဖန်တီးသည်။",
        'from itertools import count\nfor i in count(10, 5):\n    if i > 25: break\n    print(i)  # 10 15 20 25',
      ],
      [
        "ဥပမာ — မျိုးစုံစမ်းသပ်",
        "အပင်မျိုး ၅ မျိုးထဲက ၂ မျိုးတွဲ စမ်းသပ်မယ့် အတွဲအားလုံးကို `combinations(plants, 2)` နဲ့ လွယ်လွယ် ရနိုင်သည် — ကိုယ်တိုင် nested loop ရေးစရာ မလိုတော့ပါ။",
      ],
    ],
  ),
  py(
    "py-functools",
    "functools module",
    "reduce, lru_cache, partial — function tools။",
    10,
    "python functools lru_cache tutorial",
    'from functools import lru_cache, reduce\n\n@lru_cache\ndef fib(n):\n    return n if n < 2 else fib(n-1) + fib(n-2)\n\nprint("fib(30):", fib(30))\n\ntotal = reduce(lambda a, b: a + b, [10, 20, 30], 0)\nprint("total:", total)',
    [
      [
        "lru_cache — ရလဒ်မှတ်ထား",
        "`@lru_cache` decorator က function ရဲ့ ရလဒ်ကို input အလိုက် မှတ်ထားပေးသည်။ တူညီတဲ့ input ကို ထပ်ခေါ်ရင် ပြန်တွက်စရာမလို — ချက်ချင်း ပြန်ပေးလို့ အလွန်မြန်သည်။ recursion လေးတွေမှာ အထူး ထိရောက်သည်။",
        '@lru_cache\ndef slow(n):\n    return n * n  # ဒုတိယအကြိမ် ခေါ်ရင် cache က ပြန်ပေး',
      ],
      [
        "reduce — စုချုံ့ခြင်း",
        "`reduce(fn, items, start)` က list တစ်ခုလုံးကို တန်ဖိုးတစ်ခုအဖြစ် စုချုံ့သည်။ `sum()` နဲ့ ဆင်ပေမဲ့ ကိုယ်ပိုင် logic (မြှောက်ခြင်း၊ အကြီးဆုံးရှာခြင်း) ထည့်နိုင်သည်။",
        'product = reduce(lambda a, b: a * b, [1,2,3,4])\nprint(product)  # 24',
      ],
      [
        "partial — argument ကြိုသတ်မှတ်",
        "`partial(fn, arg)` က function တစ်ခုရဲ့ argument အချို့ကို ကြိုဖြည့်ထားတဲ့ function အသစ် ဖန်တီးပေးသည် — အကြိမ်ကြိမ် ထပ်ရိုက်စရာ မလိုတော့ပါ။",
        'from functools import partial\ncube = partial(pow, exp=3)  # pow(x, 3)',
      ],
    ],
  ),
  py(
    "py-context-managers",
    "Context Managers (with)",
    "with statement ဘယ်လိုအလုပ်လုပ်လဲ — ကိုယ်ပိုင်ဖန်တီးခြင်း။",
    10,
    "python context manager tutorial",
    'from contextlib import contextmanager\n\n@contextmanager\ndef timer(label):\n    print(f"[{label}] စတင်")\n    yield\n    print(f"[{label}] ပြီးဆုံး")\n\nwith timer("စိုက်ခင်း စစ်ဆေးမှု"):\n    total = sum(range(1000))\n    print("total:", total)',
    [
      [
        "with ရဲ့ အလုပ်",
        "`with` က resource တစ်ခုကို **ဖွင့် → သုံး → ပိတ်** အဆင့်သုံးဆင့်ကို အာမခံပေးသည်။ ဖိုင်၊ database connection၊ lock များအတွက် အသုံးဝင်သည် — အလုပ်ကြားမှာ error တက်လည်း 'ပိတ်' အဆင့်ကို အမြဲ လုပ်ပေးသည်။",
        'with open("a.txt") as f:\n    data = f.read()  # ဖိုင် အလိုအလျောက် ပိတ်',
      ],
      [
        "ကိုယ်ပိုင် ဖန်တီးခြင်း",
        "`@contextmanager` decorator ကို generator function တစ်ခုမှာ တပ်ပြီး `yield` ရဲ့ အပေါ်က setup၊ အောက်က cleanup ဖြစ်စေနိုင်သည် — class ကြီး ရေးစရာ မလိုဘဲ ကိုယ်ပိုင် `with` block ဖန်တီးနိုင်သည်။",
        '@contextmanager\ndef opened(path):\n    f = open(path)\n    try:\n        yield f\n    finally:\n        f.close()',
      ],
      [
        "အကျိုး",
        "resource ကို မမေ့ဘဲ အမြဲ သန့်ရှင်းစွာ ပိတ်ပေးလို့ memory leak နဲ့ ဖိုင် lock ပြဿနာများ လျော့သည်။ database connection pool၊ lock၊ အချိန်တိုင်းတာမှု စတဲ့ 'အစ-အဆုံး' လိုတဲ့ အလုပ်တိုင်းအတွက် သင့်တော်သည်။",
      ],
    ],
  ),
  py(
    "py-type-hints",
    "Type Hints",
    "code ကို ရှင်းလင်း/လုံခြုံစေမယ့် type annotation။",
    10,
    "python type hints tutorial",
    'def area(width: float, height: float) -> float:\n    return width * height\n\ndef greet(names: list[str]) -> None:\n    for n in names:\n        print("မင်္ဂလာပါ", n)\n\nprint(area(3.5, 2.0))\ngreet(["Mai", "Aung"])',
    [
      [
        "annotation ရေးနည်း",
        "`def area(w: float, h: float) -> float:` — parameter တစ်ခုစီရဲ့ type ကို `: type` နဲ့၊ return type ကို `-> type` နဲ့ ဖော်ပြသည်။ Python က run-time မှာ မတားပေမဲ့ editor (VS Code) က အမှားများ ကြိုပြ၊ autocomplete ပေးသည်။",
        'age: int = 25\nname: str = "Mai"',
      ],
      [
        "ရှုပ်ထွေးတဲ့ type များ",
        "`list[int]`, `dict[str, float]`, `tuple[int, int]` စသဖြင့် ရေးနိုင်သည်။ `str | None` က 'str သို့ None' — ရှိချင်ရှိ၊ မရှိချင်နေ တန်ဖိုးများအတွက်။ code ကြီးလာရင် ဒါတွေက ဖတ်ရ/ပြင်ရ အလွန်လွယ်စေသည်။",
        'def find(id: int) -> str | None:\n    return None',
      ],
      [
        "mypy — type စစ်ဆေးမှု",
        "`mypy` tool က type အမှားများ (str နေရာမှာ int ထည့်မိတာမျိုး) ကို program မ run ခင် ရှာဖွေပေးသည်။ team နဲ့ project ကြီးများမှာ bug များစွာကို ကြိုဖမ်းနိုင်လို့ အထူးအသုံးဝင်သည်။",
      ],
    ],
  ),
  py(
    "py-dataclasses",
    "Dataclasses",
    "data သိမ်းဖို့ class များကို လွယ်လွယ် ဖန်တီးခြင်း။",
    10,
    "python dataclasses tutorial",
    'from dataclasses import dataclass\n\n@dataclass\nclass Plant:\n    name: str\n    days: int = 90\n    organic: bool = True\n\ntomato = Plant("tomato", 80)\nprint(tomato)\nprint("Same?", Plant("mint") == Plant("mint"))',
    [
      [
        "@dataclass decorator",
        "`@dataclass` ကို class ပေါ်မှာ တပ်လိုက်ရုံနဲ့ `__init__` (constructor)၊ `__repr__` (print ပုံ)၊ `__eq__` (နှိုင်းယှဉ်) များကို Python က အလိုအလျောက် ရေးပေးသည် — boilerplate code များစွာ လျှော့ပေးသည်။",
        '@dataclass\nclass Point:\n    x: int\n    y: int',
      ],
      [
        "field နဲ့ default",
        "field တစ်ခုစီကို `name: type` နဲ့ ကြေညာ၊ `= value` နဲ့ default တန်ဖိုး ထည့်နိုင်သည်။ default ရှိတဲ့ field များကို default မရှိတာတွေ နောက်မှာ ထားရသည်။",
        '@dataclass\nclass Sensor:\n    id: str\n    unit: str = "C"',
      ],
      [
        "ဘယ်အခါသုံး",
        "data အများကြီး သိမ်းတဲ့ object (Sensor reading, Product, Plant) များအတွက် ရိုးရိုး class ရေးတာထက် dataclass က အလွန်သန့်သည်။ `frozen=True` ထည့်ရင် ပြောင်းလို့မရတဲ့ (immutable) object ဖြစ်စေသည်။",
      ],
    ],
  ),
  py(
    "py-enum",
    "Enum",
    "သတ်မှတ်ထားတဲ့ တန်ဖိုးအစုကို ကိုယ်စားပြုခြင်း။",
    9,
    "python enum tutorial",
    'from enum import Enum\n\nclass Status(Enum):\n    PENDING = "pending"\n    ACTIVE = "active"\n    DONE = "done"\n\norder = Status.ACTIVE\nprint(order, "->", order.value)\nprint("Active?", order == Status.ACTIVE)',
    [
      [
        "Enum ဆိုတာ",
        "ရွေးစရာ အနည်းငယ်သာ ရှိတဲ့ တန်ဖိုးများ (status: pending/active/done၊ ဦးတည်ချက်: N/S/E/W) ကို ကိန်းသေ အုပ်စုအဖြစ် သတ်မှတ်ပေးသည်။ magic string တွေ ပြန့်ကျဲသုံးတာထက် စီမံရ လွယ်၊ စာလုံးမှားတာ လျော့သည်။",
        'class Dir(Enum):\n    NORTH = 1\n    SOUTH = 2',
      ],
      [
        "value နဲ့ name",
        "`Status.ACTIVE.value` က `\"active\"` (တန်ဖိုး)၊ `Status.ACTIVE.name` က `\"ACTIVE\"` (နာမည်)။ `Status(\"active\")` နဲ့ တန်ဖိုးကနေ member ကို ပြန်ရှာနိုင်သည်။ loop နဲ့ member အားလုံး ဖြတ်နိုင်သည်။",
        'for s in Status:\n    print(s.name, s.value)',
      ],
      [
        "အကျိုး",
        "code တစ်နေရာမှာ ပြင်ရင် သုံးထားသမျှ အားလုံး လိုက်ပြောင်းသည်။ `if status == \"actve\"` လို စာလုံးမှားတာမျိုးကို `if status == Status.ACTIVE` က ကာကွယ်ပေး — editor က မှားရင် ချက်ချင်း ပြသည်။",
      ],
    ],
  ),
  py(
    "py-virtualenv",
    "Virtual Environment နဲ့ pip",
    "project တစ်ခုစီအတွက် သီးသန့် package ပတ်ဝန်းကျင်။",
    9,
    "python virtual environment venv pip tutorial",
    '# ဒါက terminal command များ (playground မှာ run ၍မရ)\n# python -m venv venv\n# source venv/bin/activate\n# pip install requests\n# pip freeze > requirements.txt\n\n# Python ကုဒ်ထဲမှာတော့ package ကို ဒီလို သုံးသည်\nimport math\nprint(math.pi)\nprint(math.sqrt(144))',
    [
      [
        "ဘာကြောင့် လိုအပ်လဲ",
        "project မတူရင် package version မတူနိုင်သည် (project A က Django 3၊ project B က Django 5)။ virtual environment (venv) က project တစ်ခုစီအတွက် သီးခြား package အစု ထားပေးလို့ တစ်ခုနဲ့တစ်ခု မထိခိုက်ပါ။",
        '# terminal:\npython -m venv venv',
      ],
      [
        "ဖန်တီး/ဝင်/ထွက်",
        "`python -m venv venv` က ဖန်တီး၊ Mac/Linux မှာ `source venv/bin/activate`၊ Windows မှာ `venv\\Scripts\\activate` က ဝင်သည်။ ဝင်ပြီးရင် terminal ရှေ့မှာ `(venv)` ပေါ်လာသည်။ `deactivate` က ထွက်။",
      ],
      [
        "pip — package မန်နေဂျာ",
        "`pip install requests` က internet မှ package ထည့်၊ `pip freeze > requirements.txt` က သုံးထားသမျှ package + version ကို ဖိုင်တစ်ခုမှာ သိမ်းသည်။ အခြားသူ `pip install -r requirements.txt` နဲ့ တူညီစွာ ပြန်တပ်နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-requests",
    "Internet မှ data ယူခြင်း (requests)",
    "HTTP request နဲ့ API/website မှ data ဆွဲယူခြင်း။",
    11,
    "python requests library tutorial",
    '# requests က third-party package (pip install requests)\n# playground မှာ run ၍မရနိုင်လို့ pattern ကို ဖတ်ပါ\n#\n# import requests\n# r = requests.get("https://api.example.com/weather")\n# if r.status_code == 200:\n#     data = r.json()\n#     print(data["temp"])\n\n# json ကို parse လုပ်ပုံ ဒီမှာ လေ့ကျင့်နိုင်\nimport json\nfake = \'{"temp": 32, "rain": false}\'\ndata = json.loads(fake)\nprint("အပူချိန်:", data["temp"])',
    [
      [
        "requests library",
        "`requests` က Python ရဲ့ အသုံးအများဆုံး HTTP library (pip နဲ့ တပ်ရသည်)။ `requests.get(url)` က website/API ကို ခေါ်ဆိုပြီး response object ပြန်ရသည်။ POST, PUT, DELETE method များလည်း ရှိသည်။",
        'import requests\nr = requests.get(url)',
      ],
      [
        "response ဖတ်ခြင်း",
        "`r.status_code` က အောင်မြင်မှု (200 = OK၊ 404 = မတွေ့၊ 500 = server error)။ `r.json()` က JSON response ကို dict အဖြစ်၊ `r.text` က raw စာသားအဖြစ် ပေးသည်။ status အရင် စစ်ပြီးမှ ဖတ်သင့်သည်။",
        'if r.status_code == 200:\n    data = r.json()',
      ],
      [
        "ဥပမာ — ရာသီဥတု",
        "ရာသီဥတု API ကို ခေါ်ပြီး မိုးရွာနိုင်ခြေကို ဖမ်းယူကာ 'ရေလောင်းသင့်/မသင့်' ဆုံးဖြတ်တဲ့ script ရေးနိုင်သည်။ ဒါက smart farm automation ရဲ့ အခြေခံ pattern — data ယူ → ဆုံးဖြတ် → လုပ်ဆောင်။",
      ],
    ],
  ),
  py(
    "py-scraping-basics",
    "Web Scraping အခြေခံ",
    "website မှ အချက်အလက် ကောက်ယူခြင်း — BeautifulSoup။",
    11,
    "python beautifulsoup web scraping tutorial",
    '# BeautifulSoup က third-party (pip install beautifulsoup4)\n# pattern ကို ဖတ်ပါ:\n#\n# from bs4 import BeautifulSoup\n# soup = BeautifulSoup(html, "html.parser")\n# for h in soup.find_all("h2"):\n#     print(h.text)\n\n# HTML string ကနေ tag ရှာတာ ဒီမှာ ခံစားကြည့်\nhtml = "<h2>Tomato</h2><h2>Chili</h2>"\nimport re\nfor name in re.findall(r"<h2>(.*?)</h2>", html):\n    print("plant:", name)',
    [
      [
        "HTML ဆွဲ + parse",
        "`requests` နဲ့ စာမျက်နှာ HTML ကို ဆွဲပြီး `BeautifulSoup(html, \"html.parser\")` နဲ့ tag များထဲက data ကို ရွေးထုတ်သည်။ raw HTML ကို ကိုယ်တိုင် ခွဲခြမ်းစရာ မလို — soup က လုပ်ပေးသည်။",
        'soup = BeautifulSoup(html, "html.parser")',
      ],
      [
        "ရွေးထုတ်ခြင်း",
        "`soup.find(\"h1\")` က ပထမဆုံး၊ `soup.find_all(\"a\")` က link အားလုံး၊ `soup.select(\".price\")` က CSS selector နဲ့ ရွေးသည်။ `.text` က tag ထဲက စာသား၊ `[\"href\"]` က attribute တန်ဖိုး ယူသည်။",
        'for a in soup.find_all("a"):\n    print(a["href"], a.text)',
      ],
      [
        "ကျင့်ဝတ်နဲ့ တာဝန်",
        "website ရဲ့ စည်းကမ်း (robots.txt, Terms) ကို လိုက်နာပါ။ အလွန်အကျွံ/မြန်လွန်း ခေါ်ဆိုခြင်း (spam) က server ကို ဒုက္ခပေးလို့ ရှောင်ပါ — request တစ်ခုနဲ့တစ်ခုကြား ခဏနား၍ တာဝန်သိသိ သုံးပါ။",
      ],
    ],
  ),
  py(
    "py-sqlite",
    "SQLite Database",
    "Python ထဲမှာ တိုက်ရိုက် database သုံးခြင်း — sqlite3။",
    11,
    "python sqlite3 tutorial",
    'import sqlite3\n\nconn = sqlite3.connect(":memory:")   # RAM ထဲ database\nconn.execute("CREATE TABLE sales (product TEXT, qty INT)")\nconn.execute("INSERT INTO sales VALUES (?, ?)", ("tomato", 10))\nconn.execute("INSERT INTO sales VALUES (?, ?)", ("chili", 5))\nconn.commit()\n\nfor row in conn.execute("SELECT * FROM sales"):\n    print(row)',
    [
      [
        "built-in database",
        "`import sqlite3` က Python မှာ ပါပြီးသား — ဖိုင်တစ်ခုတည်း (သို့ `\":memory:\"` RAM) နဲ့ database တစ်ခုလုံး ရသည်။ server install စရာ မလို။ ကိုယ်ပိုင် app, prototype, အသေးစား tool များအတွက် အကောင်းဆုံး။",
        'conn = sqlite3.connect("shop.db")',
      ],
      [
        "query run ခြင်း",
        "`conn.execute(sql)` က query run သည်။ data ပြင်ဆင် (INSERT/UPDATE/DELETE) ပြီးရင် `conn.commit()` နဲ့ အတည်ပြုရသည် — မလုပ်ရင် ပြောင်းလဲမှု မသိမ်းပါ။ SELECT ရဲ့ ရလဒ်ကို loop နဲ့ ဖတ်နိုင်သည်။",
        'conn.execute("UPDATE sales SET qty=20")\nconn.commit()',
      ],
      [
        "parameter — လုံခြုံရေး",
        "value ထည့်ရင် `?` placeholder သုံးပြီး tuple နဲ့ ပေးပါ။ string ပေါင်း (`\"... \" + name`) တာက SQL injection အန္တရာယ် ရှိ — hacker က query ကို ပြောင်းပစ်နိုင်သည်။ placeholder က ဒါကို ကာကွယ်ပေးသည်။",
        'conn.execute("SELECT * FROM sales WHERE product=?", (name,))',
      ],
    ],
  ),
  py(
    "py-argparse",
    "Command-Line App (argparse)",
    "terminal မှ argument လက်ခံတဲ့ program ရေးခြင်း။",
    9,
    "python argparse tutorial",
    '# argparse က terminal argument အတွက် (playground မှာ တိုက်ရိုက်စမ်း၍မရ)\n# python water.py --days 90 --plant tomato\n#\n# import argparse\n# p = argparse.ArgumentParser()\n# p.add_argument("--days", type=int, required=True)\n# p.add_argument("--plant", default="unknown")\n# args = p.parse_args()\n# print(args.days, args.plant)\n\n# logic ကို ဒီမှာ စမ်းနိုင်\ndef plan(days, plant):\n    return f"{plant}: ရိတ်ရန် {days} ရက်"\nprint(plan(90, "tomato"))',
    [
      [
        "CLI ဆိုတာ",
        "`python water.py --days 90 --plant tomato` လို terminal ကနေ တိုက်ရိုက် argument ပေးပြီး သုံးလို့ရတဲ့ program။ automation, cron job, server script များအတွက် အသုံးဝင်သည် — UI မလို။",
      ],
      [
        "argparse သုံးနည်း",
        "`ArgumentParser()` ဖန်တီး၊ `add_argument(\"--days\", type=int)` နဲ့ လက်ခံမယ့် argument သတ်မှတ်၊ `parse_args()` က parse လုပ်ပေးသည်။ `args.days` နဲ့ ယူသည်။ `required=True`, `default=...`, `choices=[...]` စတာတွေ ထည့်နိုင်သည်။",
        'p.add_argument("--days", type=int, required=True)',
      ],
      [
        "အလိုအလျောက် အကျိုးကျေးဇူး",
        "argparse က `--help` message, type စစ်ဆေးမှု, မှားရင် error message ပြခြင်း စတာတွေ အလိုအလျောက် ပေးလို့ professional CLI tool လွယ်လွယ် ဆောက်နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-logging",
    "Logging",
    "program ရဲ့ အဖြစ်အပျက်ကို print ထက်ကောင်းစွာ မှတ်တမ်းတင်ခြင်း။",
    9,
    "python logging tutorial",
    'import logging\n\nlogging.basicConfig(level=logging.INFO,\n                    format="%(levelname)s: %(message)s")\n\nlogging.info("sensor ချိတ်ဆက်ပြီး")\nlogging.warning("အပူချိန် မြင့်နေ")\nlogging.error("ရေ ပန့် ချို့ယွင်း")',
    [
      [
        "print ထက် ဘာကြောင့်ကောင်း",
        "`logging` က message များကို အဆင့် (DEBUG < INFO < WARNING < ERROR < CRITICAL) ခွဲ၊ အချိန်တံဆိပ် ထည့်၊ ဖိုင်ထဲ သိမ်း၊ level အလိုက် စစ်ထုတ်ပေးနိုင်သည် — print နဲ့ မရနိုင်တာတွေ။ production မှာ print မသုံးသင့်။",
      ],
      [
        "အသုံးပြုနည်း",
        "`logging.basicConfig(level=logging.INFO)` က ဘယ်အဆင့်ကစ ပြမလဲ သတ်မှတ်၊ ပြီးရင် `logging.info(...)`, `.warning(...)`, `.error(...)` ခေါ်သည်။ `format` နဲ့ message ပုံစံ၊ `filename=` နဲ့ ဖိုင်ထဲ သိမ်းနိုင်သည်။",
        'logging.basicConfig(filename="app.log", level=logging.DEBUG)',
      ],
      [
        "ဘယ်အခါ သုံး",
        "server, automation script, ကြာရှည် run တဲ့ program များအတွက် 'ဘာဖြစ်သွားလဲ' ပြန်ရှာဖွေရာမှာ log က မရှိမဖြစ်။ WARNING/ERROR တွေကိုသာ ပြထားရင် အရေးကြီးတာကို လွယ်လွယ် တွေ့နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-testing",
    "Testing (assert / pytest)",
    "code မှန်/မမှန် အလိုအလျောက် စစ်ဆေးခြင်း။",
    10,
    "python pytest tutorial",
    'def add(a, b):\n    return a + b\n\ndef total_price(qty, price):\n    return qty * price\n\n# assert တွေက မှားရင် error ပြသည်\nassert add(2, 3) == 5\nassert total_price(10, 500) == 5000\nassert add(-1, 1) == 0\nprint("test အားလုံး အောင်မြင်! ✅")',
    [
      [
        "ဘာကြောင့် test",
        "code ပြင်တိုင်း ဟောင်းတာတွေ ကျိုး/မကျိုး လက်နဲ့ စစ်ရတာ ပင်ပန်း၊ မေ့တတ်သည်။ test က တစ်ချက်နှိပ်ရုံနဲ့ အားလုံးကို အလိုအလျောက် ပြန်စစ်ပေးလို့ ယုံကြည်စိတ်ချစွာ ပြင်ဆင်နိုင်သည်။",
      ],
      [
        "assert",
        "test ရဲ့ အနှစ်သာရက `assert condition` — condition မှန်ရင် ဘာမှမဖြစ်၊ မှားရင် `AssertionError` ပြသည်။ `assert add(2,3) == 5` က function ရဲ့ ရလဒ်ကို မျှော်မှန်းချက်နဲ့ တိုက်စစ်သည်။",
        'assert total_price(0, 500) == 0',
      ],
      [
        "pytest",
        "`pip install pytest` ပြီး `test_` နဲ့စတဲ့ function များ ရေးပြီး `pytest` command run ရုံ — pytest က test အားလုံးကို ရှာ၊ run, ဘယ်ဟာ fail လဲ ရှင်းရှင်း report ပေးသည်။ လွယ်ကူပြီး လူသုံးအများဆုံး framework။",
        'def test_add():\n    assert add(2, 2) == 4',
      ],
    ],
  ),
  py(
    "py-os-paths",
    "ဖိုင်စနစ်နဲ့ အလုပ်လုပ်ခြင်း (pathlib)",
    "folder, path, ဖိုင်စာရင်းများ စီမံခြင်း။",
    10,
    "python pathlib tutorial",
    'from pathlib import Path\n\n# ဖိုင်တစ်ချို့ ဆောက်\nPath("logs").mkdir(exist_ok=True)\nfor name in ["a", "b", "c"]:\n    Path(f"logs/{name}.txt").write_text("data")\n\n# csv/txt ဖိုင်များ ရှာ\nfor p in Path("logs").glob("*.txt"):\n    print(p.name, "->", p.read_text())',
    [
      [
        "pathlib — ခေတ်မီ path",
        "`from pathlib import Path` ပြီး `Path(\"data\") / \"log.txt\"` က path များကို `/` operator နဲ့ လွယ်လွယ် တွဲပေးသည် — Windows (`\\`) နဲ့ Mac/Linux (`/`) မတူတာကို အလိုအလျောက် ကိုင်တွယ်ပေးလို့ string ပေါင်းတာထက် လုံခြုံသည်။",
        'p = Path("data") / "2026" / "log.txt"',
      ],
      [
        "အသုံးများ method",
        "`p.exists()` (ရှိ/မရှိ)၊ `p.is_file()`/`p.is_dir()`၊ `p.glob(\"*.csv\")` (pattern နဲ့ ရှာ)၊ `p.mkdir()` (folder ဖန်တီး)၊ `p.read_text()`/`p.write_text()` (ဖိုင် ဖတ်/ရေး) — အသုံးဝင်တာ အားလုံး တစ်နေရာတည်း။",
        'if Path("config.json").exists():\n    print("config ရှိ")',
      ],
      [
        "ဥပမာ — batch",
        "folder ထဲက ဓာတ်ပုံ/csv ဖိုင် အားလုံးကို `glob` နဲ့ ရှာပြီး တစ်ခုချင်း အမည်ပြောင်း၊ ပြင်ဆင်၊ ပေါင်းစည်း လုပ်နိုင်သည် — ဖိုင်ရာနဲ့ချီ တစ်ပြိုင်တည်း ကိုင်တွယ်တဲ့ automation script များရဲ့ အခြေခံ။",
      ],
    ],
  ),
  py(
    "py-numpy-intro",
    "NumPy မိတ်ဆက်",
    "ကိန်းဂဏန်း array များကို မြန်ဆန်စွာ တွက်ချက်ခြင်း။",
    11,
    "python numpy tutorial for beginners",
    '# NumPy က third-party (pip install numpy)\n# concept ကို ရိုးရိုး list နဲ့ ခံစားကြည့်ရအောင်\nreadings = [28, 31, 30, 29, 33, 27]\n\navg = sum(readings) / len(readings)\nprint("ပျမ်းမျှ:", round(avg, 1))\nprint("အမြင့်ဆုံး:", max(readings))\nprint("အနိမ့်ဆုံး:", min(readings))\n# NumPy မှာ: arr.mean(), arr.max() — တစ်ကြောင်းတည်း',
    [
      [
        "array — မြန်ဆန်တဲ့ list",
        "NumPy array က Python list နဲ့ ဆင်ပေမဲ့ ကိန်းဂဏန်း တွက်ချက်မှုမှာ အဆများစွာ (10–100x) မြန်သည်။ data science, AI, image processing အားလုံး NumPy အပေါ်မှာ တည်ဆောက်ထားသည်။",
        'import numpy as np\narr = np.array([28, 31, 30, 29])',
      ],
      [
        "vectorize — loop မလို",
        "`arr * 2` က element အားလုံးကို တစ်ပြိုင်တည်း နှစ်ဆ တွက်သည် — loop ရေးစရာ မလို။ `arr + arr2`, `arr > 30` စတဲ့ operation တွေ element-wise အလုပ်လုပ်လို့ code က တိုတောင်းပြီး မြန်သည်။",
        'temps = np.array([28, 31, 33])\nhot = temps[temps > 30]  # [31, 33]',
      ],
      [
        "အသုံးဝင် function",
        "`arr.mean()` (ပျမ်းမျှ)၊ `.sum()`, `.max()`, `.min()`, `.std()` (စံသွေဖည်)၊ `.reshape()` — sensor reading ၁၀၀၀ ခုရဲ့ ကိန်းဂဏန်း စာရင်းအင်းကို တစ်ကြောင်းချင်းစီ ချက်ချင်း တွက်နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-pandas-intro",
    "Pandas မိတ်ဆက်",
    "table data ကို ခွဲခြမ်းစိတ်ဖြာခြင်း — DataFrame။",
    12,
    "python pandas tutorial for beginners",
    '# Pandas က third-party (pip install pandas)\n# DataFrame concept ကို dict + loop နဲ့ ခံစားကြည့်\nsales = [\n    {"product": "tomato", "amount": 5000},\n    {"product": "chili", "amount": 4000},\n    {"product": "tomato", "amount": 3000},\n]\n\ntotals = {}\nfor row in sales:\n    totals[row["product"]] = totals.get(row["product"], 0) + row["amount"]\nprint(totals)\n# Pandas မှာ: df.groupby("product")["amount"].sum()',
    [
      [
        "DataFrame — Python ထဲက Excel",
        "Pandas DataFrame က row, column နဲ့ data ကို စီမံတဲ့ table — Python ထဲက Excel/Google Sheets လိုပဲ။ data analysis, report, ML data preparation အတွက် အသုံးအများဆုံး tool။",
        'import pandas as pd\ndf = pd.read_csv("sales.csv")',
      ],
      [
        "ဖတ်/စစ်ထုတ်/စုစည်း",
        "`pd.read_csv(\"x.csv\")` က CSV ဖတ်၊ `df[df[\"amount\"] > 1000]` က စစ်ထုတ်၊ `df.groupby(\"product\").sum()` က အုပ်စုဖွဲ့ ပေါင်း၊ `df.sort_values(\"amount\")` က စီသည် — SQL နဲ့ ဆင်တဲ့ operation တွေ တစ်ကြောင်းစီ။",
        'top = df.groupby("product")["amount"].sum()',
      ],
      [
        "ဥပမာ — အရောင်းချုပ်",
        "POS အရောင်းစာရင်း CSV ကို ဖတ်ပြီး ကုန်ပစ္စည်းတစ်ခုစီ ဘယ်လောက် ရောင်းရလဲ၊ ဘယ်ရက် အရောင်းရဆုံးလဲ ချက်ချင်း ချုပ်နိုင်သည်။ ရလဒ်ကို matplotlib နဲ့ chart ဆွဲပြနိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-matplotlib-intro",
    "Matplotlib နဲ့ Chart ဆွဲခြင်း",
    "data ကို graph/chart အဖြစ် မြင်သာအောင် ပြသခြင်း။",
    10,
    "python matplotlib tutorial for beginners",
    '# matplotlib က third-party (pip install matplotlib)\n# ကုဒ် pattern ကို ဖတ်ပါ:\n#\n# import matplotlib.pyplot as plt\n# days = [1, 2, 3, 4, 5]\n# temp = [28, 30, 29, 33, 31]\n# plt.plot(days, temp)\n# plt.title("Temperature")\n# plt.xlabel("Day"); plt.ylabel("C")\n# plt.savefig("chart.png")\n\n# data ကို text chart နဲ့ ခံစားကြည့်\ntemp = [28, 30, 29, 33, 31]\nfor t in temp:\n    print(f"{t}C", "#" * (t - 25))',
    [
      [
        "plot လုပ်နည်း",
        "`import matplotlib.pyplot as plt` ပြီး `plt.plot(x, y)` က line chart၊ `plt.bar(x, y)` က bar chart၊ `plt.scatter(x, y)` က scatter ဆွဲသည်။ `plt.show()` က ပြ၊ `plt.savefig(\"chart.png\")` က ဓာတ်ပုံအဖြစ် သိမ်းသည်။",
        'plt.plot([1,2,3], [10,20,15])\nplt.show()',
      ],
      [
        "တန်ဆာဆင်ခြင်း",
        "`plt.title(\"...\")` (ခေါင်းစဉ်)၊ `plt.xlabel(...)`/`plt.ylabel(...)` (ဝင်ရိုး label)၊ `plt.legend()` (မှတ်ချက်)၊ `plt.grid(True)` (ဇယားကွက်) — chart ကို ရှင်းလင်း၊ ဖတ်ရလွယ်အောင် ပြင်ဆင်ပါ။",
      ],
      [
        "ဥပမာ — sensor graph",
        "အပူချိန် sensor data ကို တစ်ရက်စာ line chart ဆွဲပြီး ဘယ်အချိန် အပူဆုံးလဲ မြင်သာစေနိုင်သည်။ ရလဒ် ပုံကို gwave post အဖြစ် မျှဝေ၍ တခြားတောင်သူများနဲ့ နှိုင်းယှဉ်နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-scope-closures",
    "Scope နဲ့ Closure",
    "variable ဘယ်နေရာမှာ အသက်ဝင်လဲ — LEGB, closure။",
    11,
    "python scope and closures tutorial",
    'def make_counter():\n    count = 0\n    def increment():\n        nonlocal count\n        count += 1\n        return count\n    return increment\n\nc = make_counter()\nprint(c(), c(), c())   # 1 2 3\n# count က make_counter ပြီးသွားလည်း "အသက်ရှင်" နေဆဲ',
    [
      [
        "LEGB rule",
        "Python က variable ကို Local → Enclosing → Global → Built-in အစဉ်လိုက် ရှာသည်။ function ထဲမှာ ကြေညာတဲ့ variable က local — ပြင်ပက မမြင်ရ။ function ထဲက local က ပြင်ပ (global) variable ကို 'ဖုံး' (shadow) နိုင်သည်။",
        'x = 10\ndef f():\n    x = 20   # local အသစ်\n    print(x) # 20\nf(); print(x)  # 10',
      ],
      [
        "global နဲ့ nonlocal",
        "function ထဲကနေ ပြင်ပ variable ကို 'ပြောင်း' ချင်ရင် `global x` (module level) သို့ `nonlocal x` (enclosing function) ကို ကြေညာရသည် — မဟုတ်ရင် Python က local အသစ် တစ်ခု ဖန်တီးပစ်သည်။",
        'nonlocal count  # အပြင် function ရဲ့ count ကို ပြောင်း',
      ],
      [
        "closure",
        "အတွင်း function က ပတ်ဝန်းကျင် (enclosing) variable ကို 'မှတ်' ထားပြီး ပြန်ပေးတဲ့ function ကို closure ဟုခေါ်သည်။ enclosing function ပြီးသွားလည်း ဒီ variable က ကျန်နေသည် — private data, counter, configuration ချုပ်ကိုင်ရာမှာ သုံးသည်။",
      ],
    ],
  ),
  py(
    "py-async-intro",
    "Async မိတ်ဆက်",
    "အလုပ်များစွာကို တစ်ပြိုင်နက် စောင့်ဆိုင်းစီမံခြင်း။",
    11,
    "python async await tutorial",
    'import asyncio\n\nasync def water(plant, seconds):\n    print(f"{plant}: ရေလောင်းစ")\n    await asyncio.sleep(seconds)\n    print(f"{plant}: ပြီး")\n\nasync def main():\n    # သုံးခုလုံး တစ်ပြိုင်နက်\n    await asyncio.gather(\n        water("tomato", 1),\n        water("chili", 1),\n        water("mint", 1),\n    )\n\nasyncio.run(main())',
    [
      [
        "ဘာကြောင့် လိုအပ်လဲ",
        "internet မှ data ဆွဲ၊ ဖိုင်ဖတ် စတဲ့ 'စောင့်ရတဲ့' (I/O) အလုပ်များ အများကြီးရှိရင် တစ်ခုပြီးမှ တစ်ခု စောင့်တာက အလွန်နှေးသည်။ async က စောင့်နေစဉ် အခြားအလုပ်ကို ဆက်လုပ်ခွင့်ပေးလို့ တစ်ပြိုင်နက် ပြီးစေသည်။",
      ],
      [
        "async / await",
        "`async def` နဲ့ coroutine ကြေညာ၊ `await` နဲ့ အခြား async အလုပ်ကို 'ပိတ်ဆို့မှုမရှိ' စောင့်ပါ။ `asyncio.run(main())` က စတင်၊ `asyncio.gather(...)` က အလုပ်များစွာကို တစ်ပြိုင်နက် run သည်။",
        'async def fetch():\n    await asyncio.sleep(1)\n    return "data"',
      ],
      [
        "ဘယ်အခါ သင့်တော်",
        "async က network/ဖိုင်/database စောင့်ဆိုင်းမှု (I/O-bound) များအတွက် ထိရောက်သည်။ ဒါပေမဲ့ CPU အလုပ်ကြမ်း (ကြီးမားတဲ့ တွက်ချက်မှု) များအတွက်တော့ မကူညီ — အဲဒါတွေအတွက် multiprocessing သုံးရသည်။",
      ],
    ],
  ),
  py(
    "py-project-harvest",
    "Project — ရိတ်သိမ်း တွက်စက်",
    "သင်ယူထားသမျှ ပေါင်းစပ်၍ harvest calculator ဆောက်ခြင်း။",
    13,
    "python beginner project tutorial",
    'from datetime import datetime, timedelta\n\nCROPS = {"tomato": 80, "chili": 90, "mint": 60}\n\ndef plan(crop, start):\n    days = CROPS.get(crop)\n    if days is None:\n        raise ValueError(f"{crop} ကို မသိပါ")\n    harvest = start + timedelta(days=days)\n    return harvest, days\n\nharvest, days = plan("tomato", datetime(2026, 1, 1))\nprint(f"tomato: {days} ရက်ကြာ, ရိတ်ရန် {harvest:%Y-%m-%d}")',
    [
      [
        "ဒီဇိုင်း",
        "input — အပင်အမည်၊ စိုက်သည့်ရက်။ output — ရိတ်သိမ်းရက်၊ ကြာချိန်။ dict (crop → ရက်)၊ function၊ datetime၊ exception (မသိတဲ့ crop) — သင်ယူထားသမျှ ပေါင်းသုံးသည်။",
        'CROPS = {"tomato": 80, "chili": 90}',
      ],
      [
        "အဆင့်လိုက် တည်ဆောက်",
        "① crop → ရက်ကို dict.get() နဲ့ ရှာ ② မတွေ့ရင် ValueError raise ③ datetime + timedelta နဲ့ ရိတ်ရက် တွက် ④ f-string နဲ့ ရလဒ် format ⑤ CSV/JSON ဖိုင်ထဲ append သိမ်း။",
      ],
      [
        "တိုးချဲ့ရန်",
        "CSV ဖိုင်ထဲ မှတ်တမ်း append လုပ်ပြီး ရာသီအလိုက် ချုပ်ချက်ကို pandas နဲ့ ဆွဲ၊ matplotlib နဲ့ chart ပြ၊ argparse နဲ့ CLI tool ဖြစ်အောင် ထုပ်ပိုး — ဒီ project တစ်ခုတည်းက Python သင်ခန်းစာ အားလုံးကို ချိတ်ဆက်ပေးသည်။",
      ],
    ],
  ),
  py(
    "py-good-style",
    "သန့်ရှင်းသော Code (PEP 8)",
    "ဖတ်ရလွယ်၊ ပြင်ရလွယ်တဲ့ Python ရေးထုံး။",
    9,
    "python pep 8 clean code tutorial",
    '# ❌ မကောင်း\ndef f(x):\n    return x*0.05+x\n\n# ✅ ကောင်း — ရှင်းလင်းတဲ့ နာမည်, ကွက်လပ်\nTAX_RATE = 0.05\n\ndef with_tax(price):\n    return price + price * TAX_RATE\n\nprint(with_tax(1000))',
    [
      [
        "PEP 8 — တရားဝင် ရေးထုံး",
        "PEP 8 က Python ရဲ့ တရားဝင် ရေးထုံး လမ်းညွှန်။ ကွက်လပ် ၄ လုံး indent၊ variable/function ကို `snake_case`၊ class ကို `PascalCase`၊ constant ကို `UPPER_CASE`၊ operator ဘေးမှာ ကွက်လပ်။ လူတိုင်း တူညီစွာ ရေးရင် team အလုပ် လွယ်သည်။",
        'plant_count = 5\nMAX_TEMP = 40',
      ],
      [
        "နာမည်ကောင်း = comment ထက်ကောင်း",
        "`x`, `data`, `temp` ထက် `harvest_days`, `plant_count`, `total_price` လို ဆိုလိုရင်း ရှင်းတဲ့ နာမည်များက code ကို ကိုယ်တိုင်ပြန်ဖတ်ရင်တောင် နားလည်လွယ်စေသည်။ function နာမည်က ကြိယာ (`calculate_total`) ဖြစ်သင့်သည်။",
      ],
      [
        "tool — အလိုအလျောက်",
        "`black` က code ကို အလိုအလျောက် သပ်ရပ်စွာ format လုပ်ပေး၊ `ruff`/`flake8` က ရေးထုံးအမှားများ ထောက်ပြသည်။ ဒီ tool တွေ သုံးရင် ရေးထုံးအကြောင်း စဉ်းစားစရာမလို — code logic ကိုပဲ အာရုံစိုက်နိုင်သည်။",
      ],
    ],
  ),
  py(
    "py-random",
    "random module — ကျပန်းနဲ့ Simulation",
    "ကျပန်းဂဏန်း၊ ကျပန်းရွေးချယ်မှု၊ simulation။",
    9,
    "python random module tutorial",
    "import random\n\n# အံစာတုံး ၂ လုံး\nprint('အံစာ:', random.randint(1, 6), random.randint(1, 6))\n\n# ကျပန်း ရွေး / ရောမွှေ\ncrops = ['စပါး', 'ပြောင်း', 'ပဲ', 'နှမ်း']\nprint('ဒီရာသီ စမ်းစိုက်ရန်:', random.choice(crops))\nrandom.shuffle(crops)\nprint('ရောမွှေပြီး:', crops)\n\n# simulation — အံစာ ၁၀၀၀ ကြိမ် ပစ်ရင် ၆ ဘယ်နှခါ ကျလဲ\nsixes = sum(1 for _ in range(1000) if random.randint(1, 6) == 6)\nprint('၆ ကျတဲ့ အကြိမ်:', sixes, '(~167 လောက် ဖြစ်သင့်)')",
    [
      [
        "အဓိက function များ",
        "`random.random()` (0–1 ဒဿမ), `randint(a, b)` (a မှ b ကိန်းပြည့် — နှစ်ဖက်ပါ), `choice(seq)` (တစ်ခု ကျပန်းရွေး), `sample(seq, k)` (k ခု မထပ်ရွေး), `shuffle(seq)` (နေရာ ရောမွှေ)။ Run နှိပ်တိုင်း ရလဒ် ပြောင်းတာ playground မှာ စမ်းကြည့်ပါ။",
        "import random\nrandom.randint(1, 6)          # 1–6\nrandom.choice(['a', 'b'])     # တစ်ခု\nrandom.sample(range(50), 6)   # ထီဂဏန်း ၆ လုံး",
      ],
      [
        "seed — ထပ်ခါ ရနိုင်တဲ့ ကျပန်း",
        "`random.seed(42)` သတ်မှတ်ရင် 'ကျပန်း' ဂဏန်းတွေက အကြိမ်တိုင်း တူညီစွာ ထွက်သည် — test ရေးတဲ့အခါ၊ experiment ကို ပြန်ထပ်လုပ်ပြချင်တဲ့အခါ (reproducibility) မရှိမဖြစ်။ data science/AI မှာ အမြဲတွေ့ရမယ့် အလေ့အထ။",
        "import random\nrandom.seed(42)\nprint(random.randint(1, 100))  # အမြဲ တူတူ ထွက်",
      ],
      [
        "simulation တွေးနည်း",
        "ဖြစ်နိုင်ခြေ မေးခွန်းကို သင်္ချာနဲ့ မတွက်တတ်ရင် — အကြိမ် ထောင်ချီ ကျပန်း စမ်း (Monte Carlo simulation) ပြီး ရာခိုင်နှုန်း ကြည့်လို့ရသည်။ ဥပမာ — မိုးရွာနိုင်ခြေ 30% ရက် ၁၀ ရက်မှာ အနည်းဆုံး ၃ ရက် ရွာဖို့ ဘယ်လောက် သေချာလဲ။ playground ထဲက အံစာ simulation ကို ဒီပုံစံ ချဲ့စမ်းကြည့်ပါ။",
      ],
    ],
  ),
];
