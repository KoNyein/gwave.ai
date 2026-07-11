// Teaching aids for the AI track: original SVG diagrams (in
// /public/learn/ai) and hands-on Python code samples, merged at
// track-assembly time. Pure data.

import type { Lesson } from "@/lib/learn/lessons";
import {
  enrichLessons,
  type CodeExtra,
  type LessonImage,
} from "@/lib/learn/media-enrich";

const IMG = "/learn/ai";

const IMAGES: Record<string, LessonImage> = {
  "ai-machine-learning": {
    src: `${IMG}/ml-flow.svg`,
    alt: "Machine learning pipeline diagram",
    caption: "Data → Training → Model → Predict — ML စက်ဝန်း",
  },
  "ai-how-learns": {
    src: `${IMG}/ml-flow.svg`,
    alt: "How a model learns from data",
    caption: "Rule ရေးမပေးဘဲ data ကနေ ပုံစံ သင်ယူပုံ",
  },
  "ai-neural-networks": {
    src: `${IMG}/neural-net.svg`,
    alt: "Three layer neural network",
    caption: "Input → Hidden → Output — neuron များ ချိတ်ဆက်ပုံ",
  },
  "ai-deep-learning": {
    src: `${IMG}/neural-net.svg`,
    alt: "Deep neural network layers",
    caption: "အလွှာများလေ ပိုရှုပ်တဲ့ ပုံစံ သင်ယူနိုင်လေ — deep learning",
  },
  "ai-overfitting": {
    src: `${IMG}/overfitting.svg`,
    alt: "Overfitting train vs test error curves",
    caption: "Train error ကျနေပေမယ့် test error ပြန်တက် = ကျက်မှတ်နေပြီ",
  },
  "ai-evaluation": {
    src: `${IMG}/train-test.svg`,
    alt: "Train test split diagram",
    caption: "မမြင်ဖူးတဲ့ data နဲ့မှ တကယ့် စွမ်းရည် တိုင်းလို့ရ",
  },
  "ai-train-test-split": {
    src: `${IMG}/train-test.svg`,
    alt: "80/20 train test split",
    caption: "80% သင်၊ 20% စာမေးပွဲ — မရောစေနဲ့",
  },
  "ai-cnn": {
    src: `${IMG}/cnn.svg`,
    alt: "CNN layers from image to label",
    caption: "ပုံ → filter → pooling → features → အဖြေ",
  },
  "ai-computer-vision": {
    src: `${IMG}/cnn.svg`,
    alt: "How CNN processes an image",
    caption: "စက်က ပုံကို အလွှာလိုက် နားလည်သွားပုံ",
  },
  "ai-gradient-descent": {
    src: `${IMG}/gradient-descent.svg`,
    alt: "Gradient descent on a loss curve",
    caption: "Loss တောင်ကုန်းကို လျှောဆုံးဘက် တစ်လှမ်းချင်း ဆင်း",
  },
  "ai-loss-function": {
    src: `${IMG}/gradient-descent.svg`,
    alt: "Loss landscape",
    caption: "Loss = မှားနှုန်း — ဒါကို အနည်းဆုံးဖြစ်အောင် ရှာ",
  },
  "ai-transformers": {
    src: `${IMG}/transformer.svg`,
    alt: "Attention between tokens",
    caption: "စကားလုံးချင်း ဘယ်လောက် ဂရုစိုက်လဲ — attention",
  },
  "ai-attention": {
    src: `${IMG}/transformer.svg`,
    alt: "Attention weights visualization",
    caption: "မျဉ်းထူလေ ဂရုစိုက်မှုများလေ — attention weight",
  },
  "ai-rag": {
    src: `${IMG}/rag.svg`,
    alt: "RAG pipeline diagram",
    caption: "ရှာ → ဖြည့် → ဖြေ — မိမိ data နဲ့ တိကျအောင်",
  },
  "ai-vector-database": {
    src: `${IMG}/rag.svg`,
    alt: "Vector database in RAG",
    caption: "Vector DB — အဓိပ္ပာယ်တူတာ ရှာပေးတဲ့ စာကြည့်တိုက်",
  },
  "ai-precision-recall": {
    src: `${IMG}/confusion-matrix.svg`,
    alt: "Confusion matrix with precision and recall",
    caption: "TP/FP/FN/TN လေးကွက် — precision နဲ့ recall ထွက်ပုံ",
  },
};

const CODE: Record<string, CodeExtra> = {
  "ai-intro": {
    heading: "လက်တွေ့ — AI program ပထမဆုံးပုဒ်",
    body: "Rule-based နဲ့ ML နှစ်မျိုးလုံးကို ၅ ကြောင်းစီနဲ့ မြင်ကြည့်။",
    code: "# Rule-based — လူက စည်းမျဉ်းရေး\ndef is_ripe(color_red):\n    return color_red > 0.7\n\n# ML — data ကနေ သင်ယူ\nfrom sklearn.tree import DecisionTreeClassifier\nmodel = DecisionTreeClassifier()\nmodel.fit(X_train, y_train)      # သင်\nprint(model.predict([[0.8, 12]])) # ခန့်မှန်း",
  },
  "ai-machine-learning": {
    heading: "လက်တွေ့ — sklearn ၅ ကြောင်း",
    body: "ML project တိုင်းရဲ့ အခြေခံပုံစံ — data, fit, predict, score။",
    code: "from sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import train_test_split\n\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2)\nmodel = RandomForestClassifier()\nmodel.fit(X_tr, y_tr)                    # ၁။ သင်\nprint(model.score(X_te, y_te))           # ၂။ စစ် (accuracy)\nprint(model.predict([[28, 65, 1.8]]))    # ၃။ သုံး",
  },
  "ai-neural-networks": {
    heading: "လက်တွေ့ — neuron တစ်လုံး လက်တွက်",
    body: "Weight, bias, activation — neuron ရဲ့ တွက်ချက်ပုံ အတိအကျ။",
    code: "import math\n\ndef neuron(inputs, weights, bias):\n    # ၁။ weighted sum\n    z = sum(x*w for x, w in zip(inputs, weights)) + bias\n    # ၂။ activation (sigmoid) — 0–1 ကြား ညှစ်\n    return 1 / (1 + math.exp(-z))\n\n# အပူ=0.7, စိုထိုင်း=0.5 → ရေလောင်းသင့်လား?\nprint(neuron([0.7, 0.5], [2.0, -1.5], 0.1))",
  },
  "ai-training-data": {
    heading: "လက်တွေ့ — dataset တစ်ခု ပုံစံ",
    body: "Features (X) နဲ့ label (y) ခွဲထားပုံ — data ကောင်းမှ model ကောင်း။",
    code: "import pandas as pd\n\ndf = pd.read_csv(\"harvest_log.csv\")\nprint(df.head())\n#    temp  humidity   ec  days_to_harvest\n# 0  28.5        65  1.8               62\n# 1  31.0        70  2.1               58\n\nX = df[[\"temp\", \"humidity\", \"ec\"]]   # features\ny = df[\"days_to_harvest\"]            # label (အဖြေမှန်)\n# data ညစ်ရင် — duplicates/nulls အရင်ရှင်း!",
  },
  "ai-generative": {
    heading: "လက်တွေ့ — API နဲ့ စာထုတ်ကြည့်",
    body: "Generative model ကို API ကနေ ခေါ်သုံးပုံ အခြေခံ။",
    code: "import anthropic\n\nclient = anthropic.Anthropic()\nmsg = client.messages.create(\n    model=\"claude-sonnet-5\",\n    max_tokens=300,\n    messages=[{\n        \"role\": \"user\",\n        \"content\": \"ခရမ်းချဉ်သီး အရွက်ဝါခြင်း အကြောင်း ၃ ချက်\"\n    }],\n)\nprint(msg.content[0].text)",
  },
  "ai-classification-regression": {
    heading: "လက်တွေ့ — နှစ်မျိုး ယှဉ်ကြည့်",
    body: "အမျိုးအစားခွဲ (classification) vs ဂဏန်းခန့်မှန်း (regression)။",
    code: "# Classification — ဘယ်အုပ်စုလဲ? (ပိုးရှိ/မရှိ)\nfrom sklearn.linear_model import LogisticRegression\nclf = LogisticRegression().fit(X, y_labels)\nprint(clf.predict(new))        # ['ပိုးရှိ']\n\n# Regression — ဘယ်လောက်လဲ? (အထွက်နှုန်း kg)\nfrom sklearn.linear_model import LinearRegression\nreg = LinearRegression().fit(X, y_kg)\nprint(reg.predict(new))        # [42.7]",
  },
  "ai-clustering": {
    heading: "လက်တွေ့ — KMeans အုပ်စုဖွဲ့",
    body: "Label မပါဘဲ ဆင်တူတာချင်း အုပ်စုခွဲ — unsupervised learning။",
    code: "from sklearn.cluster import KMeans\n\n# ဖောက်သည် data: [ဝယ်ငွေ, ဝယ်ကြိမ်]\ncustomers = [[500,2],[4800,15],[350,1],[5200,18],[90,1]]\nkm = KMeans(n_clusters=2, n_init=\"auto\").fit(customers)\nprint(km.labels_)      # [0 1 0 1 0]\n# → အုပ်စု 0 = သာမန်, အုပ်စု 1 = VIP\n# VIP တွေကို promotion ပို့ — targeted marketing",
  },
  "ai-reinforcement": {
    heading: "လက်တွေ့ — reward loop",
    body: "စမ်း → ဆုရ/ဒဏ်ရ → ပြင် — RL ရဲ့ အခြေခံ စက်ဝန်း။",
    code: "for episode in range(1000):\n    state = env.reset()\n    while not done:\n        # ε-greedy: တစ်ခါတလေ ကျပန်းစမ်း (explore)\n        if random.random() < 0.1:\n            action = random.choice(actions)\n        else:\n            action = best_action(state)   # သိပြီးသား (exploit)\n        state, reward, done = env.step(action)\n        update_q(state, action, reward)   # သင်ယူ",
  },
  "ai-features": {
    heading: "လက်တွေ့ — feature engineering",
    body: "ကုန်ကြမ်း data ကနေ model နားလည်တဲ့ feature ဖန်တီးခြင်း။",
    code: "# ကုန်ကြမ်း: စိုက်ရက်စွဲ, ရိတ်ရက်စွဲ, မိုးမီလီမီတာ\ndf[\"grow_days\"] = (df.harvest_date - df.plant_date).dt.days\ndf[\"rain_per_day\"] = df.total_rain / df.grow_days\ndf[\"is_monsoon\"] = df.plant_date.dt.month.isin([6,7,8,9])\n\n# scale ချိန် — feature ကြီးငယ် မမျှရင် model လွဲ\nfrom sklearn.preprocessing import StandardScaler\nX = StandardScaler().fit_transform(df[features])",
  },
  "ai-overfitting": {
    heading: "လက်တွေ့ — overfit ဖမ်းနည်း",
    body: "Train နဲ့ test score ကွာဟရင် ကျက်မှတ်နေပြီ — ဖြေနည်းပါ။",
    code: "print(model.score(X_train, y_train))  # 0.99 😍\nprint(model.score(X_test,  y_test))   # 0.65 😱 — overfit!\n\n# ဖြေနည်းများ —\nmodel = RandomForestClassifier(\n    max_depth=5,          # ရိုးရှင်းအောင် ကန့်\n    min_samples_leaf=10,  # အနည်းဆုံး နမူနာ\n)\n# ဒါမှမဟုတ် — data ထပ်စု, early stopping,\n# dropout (neural net), cross-validation",
  },
  "ai-evaluation": {
    heading: "လက်တွေ့ — metric စုံစစ်",
    body: "Accuracy တစ်လုံးတည်း မယုံနဲ့ — classification report အပြည့်ကြည့်။",
    code: "from sklearn.metrics import classification_report\n\ny_pred = model.predict(X_test)\nprint(classification_report(y_test, y_pred))\n#               precision  recall  f1-score\n# ပိုးမရှိ           0.92     0.95      0.93\n# ပိုးရှိ            0.78     0.68      0.73\n#\n# ⚠️ ပိုးရှိ recall 68% — ပိုးကျတာ 32% လွတ်နေ\n# ဒါ business အရ အရေးကြီးဆုံး ဂဏန်း ဖြစ်နိုင်",
  },
  "ai-computer-vision": {
    heading: "လက်တွေ့ — ပုံ classify",
    body: "သင်ပြီးသား model နဲ့ အရွက်ပုံ ရောဂါစစ်ခြင်း။",
    code: "from tensorflow import keras\nimport numpy as np\n\nmodel = keras.models.load_model(\"leaf_disease.h5\")\nimg = keras.utils.load_img(\"leaf.jpg\", target_size=(224,224))\nx = keras.utils.img_to_array(img)[None] / 255.0\n\nprobs = model.predict(x)[0]\nclasses = [\"ကျန်းမာ\", \"ပိုးကျ\", \"မှိုတက်\"]\nprint(classes[np.argmax(probs)], f\"{probs.max():.0%}\")",
  },
  "ai-nlp": {
    heading: "လက်တွေ့ — sentiment စစ်",
    body: "စာသားကို အပြုသဘော/အပျက်သဘော ခွဲခြင်း — NLP အခြေခံ။",
    code: "from transformers import pipeline\n\nclf = pipeline(\"sentiment-analysis\")\nreviews = [\n    \"This fertilizer is amazing, my plants love it\",\n    \"Package arrived broken, very disappointed\",\n]\nfor r in reviews:\n    print(clf(r)[0])\n# {'label': 'POSITIVE', 'score': 0.999}\n# {'label': 'NEGATIVE', 'score': 0.998}\n# shop review တွေ အလိုအလျောက် စောင့်ကြည့်နိုင်",
  },
  "ai-transformers": {
    heading: "လက်တွေ့ — pipeline တစ်ကြောင်းတည်း",
    body: "Transformer model ကို task အလိုက် ချက်ချင်း သုံးနည်း။",
    code: "from transformers import pipeline\n\n# စာချုံ့\nsummarizer = pipeline(\"summarization\")\n# ဘာသာပြန်\ntranslator = pipeline(\"translation_en_to_fr\")\n# မေးခွန်းဖြေ\nqa = pipeline(\"question-answering\")\n\nprint(qa(question=\"EC ဘယ်လောက်ထားရမလဲ?\",\n         context=\"Leafy greens grow best at EC 1.2-1.8\"))\n# {'answer': 'EC 1.2-1.8', ...}",
  },
  "ai-embeddings": {
    heading: "လက်တွေ့ — cosine similarity",
    body: "Embedding vector နှစ်ခု ဘယ်လောက် ဆင်လဲ တိုင်းနည်း။",
    code: "import numpy as np\n\ndef cosine(a, b):\n    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))\n\n# embed() = စာသား → vector (ဥပမာ 1536 လုံး)\nv1 = embed(\"အပင် အရွက်ဝါနေတယ်\")\nv2 = embed(\"leaves turning yellow\")\nv3 = embed(\"ဈေးနှုန်း ဘယ်လောက်လဲ\")\n\nprint(cosine(v1, v2))   # 0.89 — ဘာသာစကားကွဲပေမယ့် ဆင်\nprint(cosine(v1, v3))   # 0.12 — မဆိုင်",
  },
  "ai-prompt-advanced": {
    heading: "လက်တွေ့ — prompt တည်ဆောက်ပုံ",
    body: "Role + context + task + format — prompt ကောင်းရဲ့ လေးပိုင်း။",
    code: "prompt = \"\"\"\nသင်သည် မြန်မာ တောင်သူများကို ကူညီသော စိုက်ပျိုးရေး ပညာရှင်။  # role\n\nအခြေအနေ: ခရမ်းချဉ် ၄ ပတ်သား၊ အောက်ရွက်များ ဝါ၊       # context\nEC 3.5၊ pH 5.2\n\nဖြစ်နိုင်သော အကြောင်းရင်း ၃ ခုနဲ့ ဖြေရှင်းနည်း ပေးပါ။      # task\n\nဇယားပုံစံ၊ မြန်မာလို။                              # format\n\"\"\"",
  },
  "ai-rag": {
    heading: "လက်တွေ့ — RAG ၃ ဆင့်",
    body: "ရှာ → prompt ထဲထည့် → ဖြေခိုင်း — RAG pipeline အကျဉ်း။",
    code: "# ၁။ Retrieve — အဓိပ္ပာယ်နီးစပ်ဆုံး docs ရှာ\nq_vec = embed(question)\ndocs = vector_db.search(q_vec, top_k=3)\n\n# ၂။ Augment — တွေ့တာတွေ prompt ထဲ ဖြည့်\ncontext = \"\\n\".join(d.text for d in docs)\nprompt = f\"အောက်ပါ အချက်လက်ကိုသာ သုံး၍ ဖြေပါ:\\n{context}\\n\\nမေးခွန်း: {question}\"\n\n# ၃။ Generate — LLM က အထောက်ထားနဲ့ ဖြေ\nanswer = llm(prompt)",
  },
  "ai-agents": {
    heading: "လက်တွေ့ — agent loop",
    body: "စဉ်းစား → tool သုံး → ရလဒ်ကြည့် → ထပ်စဉ်းစား — agent စက်ဝန်း။",
    code: "tools = {\"weather\": get_weather, \"db\": query_db}\n\nwhile True:\n    response = llm(messages, tools=tool_schemas)\n    if response.tool_call:\n        # AI က tool သုံးချင် — run ပြီး ရလဒ်ပြန်ပေး\n        result = tools[response.tool_call.name](\n            **response.tool_call.args)\n        messages.append(tool_result(result))\n    else:\n        print(response.text)   # အဖြေရပြီ\n        break",
  },
  "ai-image-generation": {
    heading: "လက်တွေ့ — ပုံထုတ် prompt",
    body: "ပုံထုတ် AI အတွက် prompt ရေးနည်း — အသေးစိတ်လေ ကောင်းလေ။",
    code: "# ❌ အားနည်း\nprompt = \"farm\"\n\n# ✅ ကောင်း — အကြောင်းအရာ + style + အလင်း + ထောင့်\nprompt = (\n    \"modern hydroponic greenhouse in rural Myanmar, \"\n    \"golden morning light, lush green lettuce rows, \"\n    \"drone photo from above, photorealistic, 4k\"\n)\nimage = client.images.generate(prompt=prompt)\n# negative prompt: \"blurry, text, watermark\" — မလိုတာဖယ်",
  },
  "ai-speech-audio": {
    heading: "လက်တွေ့ — အသံ → စာ",
    body: "Whisper နဲ့ အသံဖိုင် စာသားပြောင်း — မြန်မာစကားလည်း ရ။",
    code: "import whisper\n\nmodel = whisper.load_model(\"small\")\nresult = model.transcribe(\"voice_note.mp3\",\n                          language=\"my\")   # မြန်မာ\nprint(result[\"text\"])\n\n# ပြောင်းပြန် — စာ → အသံ (TTS)\n# gwave lesson audio က browser TTS သုံး —\n# offline/အခမဲ့၊ Web Speech API",
  },
  "ai-hallucination": {
    heading: "လက်တွေ့ — hallucination လျှော့နည်း",
    body: "AI လိမ်ဖြေတာကို စစ်ဆေး/ကာကွယ်တဲ့ လက်တွေ့နည်းများ။",
    code: "prompt = \"\"\"\nအောက်ပါ စာရွက်ထဲက အချက်လက်ကိုသာ သုံးပါ။\nစာရွက်ထဲမှာ မပါရင် \"မသိပါ\" လို့ ဖြေပါ။      # ၁။ ခွင့်ပြု\n\nဖြေချက်တိုင်းရဲ့ နောက်မှာ [စာမျက်နှာ] ညွှန်းပါ။  # ၂။ citation\n\"\"\"\n\n# ၃။ temperature ချ — တီထွင်မှုလျှော့\nresponse = llm(prompt, temperature=0.1)\n\n# ၄။ အရေးကြီးရင် — လူက အမြဲ ပြန်စစ် (human in the loop)",
  },
  "ai-in-agriculture": {
    heading: "လက်တွေ့ — ရိတ်ရက် ခန့်မှန်း model",
    body: "စိုက်ခင်း sensor data ကနေ ရိတ်သိမ်းရက် ခန့်မှန်းခြင်း။",
    code: "import pandas as pd\nfrom sklearn.ensemble import GradientBoostingRegressor\n\ndf = pd.read_csv(\"grow_history.csv\")\nX = df[[\"avg_temp\",\"avg_humidity\",\"avg_ec\",\"light_hours\"]]\ny = df[\"days_to_harvest\"]\n\nmodel = GradientBoostingRegressor().fit(X, y)\n\n# လက်ရှိ ရာသီ အခြေအနေ ထည့် —\nprint(model.predict([[29.1, 68, 1.9, 13.5]]))\n# [61.3] → နောက် ၆၁ ရက် — ဈေးကွက် ကြိုစီစဉ်နိုင်",
  },
  "ai-deep-learning": {
    heading: "လက်တွေ့ — Keras ပထမ network",
    body: "အလွှာသုံးလွှာ network တည်ဆောက်-သင်-သုံး အပြည့်။",
    code: "from tensorflow import keras\n\nmodel = keras.Sequential([\n    keras.layers.Dense(16, activation=\"relu\",\n                       input_shape=(4,)),   # hidden 1\n    keras.layers.Dense(8,  activation=\"relu\"),  # hidden 2\n    keras.layers.Dense(1,  activation=\"sigmoid\"),# output\n])\nmodel.compile(optimizer=\"adam\", loss=\"binary_crossentropy\",\n              metrics=[\"accuracy\"])\nmodel.fit(X_train, y_train, epochs=50, validation_split=0.2)",
  },
  "ai-cnn": {
    heading: "လက်တွေ့ — CNN model ဆောက်",
    body: "Conv → Pool ထပ်ပြီး ပုံခွဲခြားတဲ့ network။",
    code: "model = keras.Sequential([\n    keras.layers.Conv2D(32, 3, activation=\"relu\",\n                        input_shape=(128,128,3)),\n    keras.layers.MaxPooling2D(),      # ချုံ့\n    keras.layers.Conv2D(64, 3, activation=\"relu\"),\n    keras.layers.MaxPooling2D(),\n    keras.layers.Flatten(),\n    keras.layers.Dense(64, activation=\"relu\"),\n    keras.layers.Dense(3, activation=\"softmax\"),\n])  # 3 classes: ကျန်းမာ/ပိုး/မှို",
  },
  "ai-rnn-lstm": {
    heading: "လက်တွေ့ — LSTM နဲ့ အပူချိန်ခန့်မှန်း",
    body: "အစဉ်လိုက် data (နာရီ ၂၄ ခု) ကနေ နောက်တစ်နာရီ ခန့်မှန်း။",
    code: "model = keras.Sequential([\n    keras.layers.LSTM(32, input_shape=(24, 1)),\n    keras.layers.Dense(1),\n])\nmodel.compile(optimizer=\"adam\", loss=\"mse\")\n\n# X = [နာရီ ၂၄ ခုစီ အပူချိန် ဝင်းဒိုး], y = ၂၅ နာရီမြောက်\nmodel.fit(X_windows, y_next, epochs=20)\n\nnext_temp = model.predict(last_24_hours[None])\n# greenhouse ကြို ချိန်ညှိနိုင် — အပူတက်မယ် သိရင် fan ကြိုဖွင့်",
  },
  "ai-attention": {
    heading: "လက်တွေ့ — attention score တွက်",
    body: "Query·Key → softmax → weight — attention ရဲ့ သင်္ချာ။",
    code: "import numpy as np\n\ndef softmax(x):\n    e = np.exp(x - x.max())\n    return e / e.sum()\n\n# စကားလုံးတိုင်းက query/key vector ရှိ\nscores = Q @ K.T / np.sqrt(d)   # ဆင်တူမှု တိုင်း\nweights = softmax(scores)        # 0–1 ရာခိုင်နှုန်း ပြောင်း\noutput = weights @ V             # weight အလိုက် ရော\n# \"ဆောင်း\" ရဲ့ weight: [မိုး 0.5, ရွာရင် 0.1, ထီး 0.4]",
  },
  "ai-tokenization": {
    heading: "လက်တွေ့ — token ခွဲကြည့်",
    body: "စာသားကို model မြင်တဲ့ token အတုံးလေးတွေ ခွဲကြည့်ခြင်း။",
    code: "import tiktoken\n\nenc = tiktoken.get_encoding(\"cl100k_base\")\ntext = \"Hello farmers of Myanmar!\"\ntokens = enc.encode(text)\nprint(len(tokens), tokens)      # 6 [9906, 20957, ...]\nprint([enc.decode([t]) for t in tokens])\n# ['Hello', ' farmers', ' of', ' Myanmar', '!']\n\n# မြန်မာစာ — token ပိုစားတတ် (byte-level ခွဲလို့)\n# စာလုံးရေတူ English ထက် ၂-၃ ဆ ရှိနိုင်",
  },
  "ai-context-window": {
    heading: "လက်တွေ့ — context မပြည့်အောင် ထိန်း",
    body: "Token ရေတွက်ပြီး အဟောင်းဖြတ် — chatbot memory စီမံနည်း။",
    code: "MAX_TOKENS = 8000\n\ndef fit_history(messages):\n    total = 0\n    kept = []\n    # နောက်ဆုံး message ကနေ ပြောင်းပြန်စစ်\n    for m in reversed(messages):\n        total += count_tokens(m)\n        if total > MAX_TOKENS:\n            break\n        kept.append(m)\n    return list(reversed(kept))\n# ပိုကောင်း: အဟောင်းတွေ summary ချုံ့ပြီး ရှေ့ကထား",
  },
  "ai-temperature": {
    heading: "လက်တွေ့ — temperature စမ်းကြည့်",
    body: "တန်ဖိုးအလိုက် အဖြေ ဘယ်လောက် ကွဲလဲ — ဘယ်အခါ ဘာသုံး။",
    code: "# temperature 0.0 — အမြဲတူ, တိကျ\nllm(\"EC ဆိုတာဘာလဲ\", temperature=0.0)\n# → စာမေးပွဲစစ်, data ထုတ်, code — ဒါသုံး\n\n# temperature 1.0 — ကွဲပြား, တီထွင်\nllm(\"စိုက်ခင်းအကြောင်း ကဗျာရေးပါ\", temperature=1.0)\n# → ကဗျာ, ကြော်ငြာစာ, idea ထုတ် — ဒါသုံး\n\n# ကြားထဲ 0.3–0.7 — ပုံမှန် စကားပြော",
  },
  "ai-fine-tuning": {
    heading: "လက်တွေ့ — fine-tune data ပုံစံ",
    body: "မိမိ domain အတွက် model ထပ်သင်ဖို့ example ပြင်နည်း။",
    code: "# fine-tune dataset — JSONL (တစ်ကြောင်း တစ် example)\n{\"messages\": [\n  {\"role\": \"user\",\n   \"content\": \"ခရမ်းချဉ် အရွက်အောက်ပိုင်း ဝါနေတယ်\"},\n  {\"role\": \"assistant\",\n   \"content\": \"Nitrogen ချို့တဲ့ခြင်း ဖြစ်နိုင်...\"}\n]}\n# example 100–1000+ စု → API/platform မှာ တင်သင်\n# သတိ: RAG နဲ့ အရင်စမ်း — များသောအားဖြင့် လုံလောက်ပြီး ပိုစျေးသက်သာ",
  },
  "ai-transfer-learning": {
    heading: "လက်တွေ့ — base freeze ပြီး ထပ်သင်",
    body: "သင်ပြီးသား model ရဲ့ အသိကို ယူပြီး ကိုယ့် task အတွက် ဆက်သင်။",
    code: "base = keras.applications.MobileNetV2(\n    input_shape=(224,224,3), include_top=False,\n    weights=\"imagenet\")        # ပုံ သန်းချီ သင်ပြီးသား\nbase.trainable = False         # အသိဟောင်း ထိန်းထား (freeze)\n\nmodel = keras.Sequential([\n    base,\n    keras.layers.GlobalAveragePooling2D(),\n    keras.layers.Dense(3, activation=\"softmax\"),\n])\n# ကိုယ့်အရွက်ပုံ ရာဂဏန်းလောက်နဲ့တင် accuracy ကောင်းရ",
  },
  "ai-few-shot": {
    heading: "လက်တွေ့ — few-shot prompt",
    body: "နမူနာ ၂-၃ ခု ပြရုံနဲ့ ပုံစံလိုက်တတ်စေခြင်း။",
    code: "prompt = \"\"\"\nသီးနှံနာမည်ကို အင်္ဂလိပ်-မြန်မာ ပြောင်းပါ:\n\ntomato → ခရမ်းချဉ်သီး\nlettuce → ဆလတ်ရွက်\nchili → ငရုတ်သီး\ncucumber →\"\"\"\n\nprint(llm(prompt))   # သခွားသီး\n# example ရဲ့ ပုံစံ (format) ကို တိတိကျကျ လိုက်ပေး —\n# JSON လိုချင်ရင် example တွေကိုလည်း JSON နဲ့ ပြ",
  },
  "ai-chain-of-thought": {
    heading: "လက်တွေ့ — အဆင့်လိုက် တွေးခိုင်း",
    body: "\"အဆင့်လိုက် တွေးပါ\" တစ်ကြောင်းက သင်္ချာ/logic အဖြေ မှန်စေ။",
    code: "# ❌ တိုက်ရိုက်မေး — မှားတတ်\n\"ဧက 3 မှာ တစ်ဧက ပင် 1200၊ 15% ပျက်၊ ကျန်ဘယ်နှပင်?\"\n\n# ✅ CoT — အဆင့်လိုက် တွက်ခိုင်း\nprompt = \"\"\"...ကျန်ဘယ်နှပင်?\nအဆင့်ချင်း တွက်ပြပြီးမှ နောက်ဆုံးအဖြေ ပေးပါ။\"\"\"\n# → 3×1200=3600 → 3600×0.15=540 → 3600−540=3060 ✓\n# ခေတ်သစ် reasoning model များက အလိုအလျောက် တွေးပြီးသား",
  },
  "ai-system-prompt": {
    heading: "လက်တွေ့ — system vs user",
    body: "System prompt က AI ရဲ့ တာဝန်သတ်မှတ်ချက် — user ထက် အရင်လာ။",
    code: "response = client.messages.create(\n    model=\"claude-sonnet-5\",\n    max_tokens=500,\n    system=(\n        \"သင်သည် gwave စိုက်ပျိုးရေး လက်ထောက်။ \"\n        \"မြန်မာလို ဖြေ။ ဆေးဝါး အကြံမပေး။ \"\n        \"မသေချာရင် ကျွမ်းကျင်သူနဲ့ တိုင်ပင်ခိုင်း။\"\n    ),\n    messages=[{\"role\": \"user\",\n               \"content\": \"EC ဘယ်လောက်ထားရမလဲ\"}],\n)",
  },
  "ai-function-calling": {
    heading: "လက်တွေ့ — tool သတ်မှတ်ပေး",
    body: "AI ကို ကိုယ့် function ခေါ်ခွင့်ပေးတဲ့ schema ပုံစံ။",
    code: "tools = [{\n    \"name\": \"get_sensor_reading\",\n    \"description\": \"စိုက်ခင်း sensor တန်ဖိုး ဖတ်\",\n    \"input_schema\": {\n        \"type\": \"object\",\n        \"properties\": {\n            \"sensor\": {\"type\": \"string\",\n                       \"enum\": [\"temp\",\"humidity\",\"ec\"]},\n        },\n        \"required\": [\"sensor\"],\n    },\n}]\n# user: \"အပူချိန်ဘယ်လောက်လဲ\" → AI က tool ခေါ် →\n# ကိုယ့် code က DB ဖတ်ပြန်ပေး → AI က လူလိုပြန်ဖြေ",
  },
  "ai-multimodal": {
    heading: "လက်တွေ့ — ပုံ + စာ တွဲမေး",
    body: "အရွက်ပုံ တင်ပြီး ရောဂါမေးခြင်း — multimodal input။",
    code: "import base64\n\nwith open(\"sick_leaf.jpg\", \"rb\") as f:\n    img = base64.b64encode(f.read()).decode()\n\nresponse = client.messages.create(\n    model=\"claude-sonnet-5\", max_tokens=500,\n    messages=[{\"role\": \"user\", \"content\": [\n        {\"type\": \"image\", \"source\": {\n            \"type\": \"base64\", \"media_type\": \"image/jpeg\",\n            \"data\": img}},\n        {\"type\": \"text\",\n         \"text\": \"ဒီအရွက် ဘာဖြစ်နေလဲ? ကုနည်းပါ ပြောပါ\"},\n    ]}],\n)",
  },
  "ai-diffusion": {
    heading: "လက်တွေ့ — diffusion သဘော",
    body: "ဆူညံသံကနေ ပုံဖြစ်လာတဲ့ denoise စက်ဝန်း — pseudocode။",
    code: "# Training: ပုံကို noise ထည့်သွားပြီး —\n# \"ဒီ noise ကို ဘယ်လိုပြန်ဖြုတ်မလဲ\" သင်ထား\n\n# Generation — ပြောင်းပြန်:\nimage = random_noise()             # ဆူညံသံ စစ်စစ်\nfor t in range(50, 0, -1):         # ၅၀ ဆင့်\n    predicted_noise = model(image, t, prompt)\n    image = image - predicted_noise * step(t)\n    # တစ်ဆင့်ချင်း ပုံပေါ်လာ — မှုန် → ကြည်\nreturn image",
  },
  "ai-gans": {
    heading: "လက်တွေ့ — GAN နှစ်ပွဲပြိုင်",
    body: "အတုလုပ်သူ vs စစ်ဆေးသူ — ပြိုင်ရင်း နှစ်ဦးလုံး တော်လာ။",
    code: "for epoch in range(epochs):\n    # ၁။ Discriminator သင် — အစစ်/အတု ခွဲတတ်အောင်\n    real_loss = D.train(real_images, label=1)\n    fake = G(random_noise())\n    fake_loss = D.train(fake, label=0)\n\n    # ၂။ Generator သင် — D ကို လှည့်စားနိုင်အောင်\n    g_loss = G.train(target=\"D ကို 1 ထင်အောင်\")\n\n# ပြိုင်ရင်း G ရဲ့ အတုပုံ တဖြည်းဖြည်း အစစ်နီးလာ",
  },
  "ai-recommendation": {
    heading: "လက်တွေ့ — ဆင်တူ ထုတ်ကုန် ညွှန်း",
    body: "ဝယ်ယူမှု ဆင်တူသူတွေ အခြေခံ recommendation။",
    code: "from sklearn.metrics.pairwise import cosine_similarity\n\n# user × product matrix (ဝယ်=1)\nsim = cosine_similarity(user_product_matrix)\n\ndef recommend(user_id, n=5):\n    # ကိုယ်နဲ့ အဆင်တူဆုံး user များ ရှာ\n    similar = sim[user_id].argsort()[::-1][1:20]\n    # သူတို့ဝယ်ပြီး ကိုယ်မဝယ်ရသေးတာ စုစီ\n    candidates = purchases[similar].sum(0)\n    candidates[purchases[user_id] > 0] = 0\n    return candidates.argsort()[::-1][:n]",
  },
  "ai-anomaly-detection": {
    heading: "လက်တွေ့ — z-score နဲ့ ထူးခြားမှုဖမ်း",
    body: "Sensor ဖတ်ချက် ပုံမှန်ဘောင်ကျော်ရင် ချက်ချင်း သတိပေး။",
    code: "import numpy as np\n\nwindow = readings[-100:]          # နောက်ဆုံး ၁၀၀ ချက်\nmean, std = np.mean(window), np.std(window)\n\ndef check(new_value):\n    z = abs(new_value - mean) / std\n    if z > 3:                     # 3σ ကျော် — ထူးခြား\n        alert(f\"ပုံမှန်မဟုတ်: {new_value} (z={z:.1f})\")\n        # ဥပမာ: pump ပျက်လို့ EC ရုတ်တရက် တက်\n    return z > 3",
  },
  "ai-forecasting": {
    heading: "လက်တွေ့ — ရိုးရိုး forecast",
    body: "Moving average + seasonality — ခန့်မှန်းချက် အခြေခံနှစ်မျိုး။",
    code: "import pandas as pd\n\ns = pd.Series(daily_sales, index=dates)\n\n# ၁။ လှုပ်ခတ်မှုချော — ရက် ၇ ရက် ပျမ်းမျှ\ntrend = s.rolling(7).mean()\n\n# ၂။ ရာသီပုံစံ — တနင်္ဂနွေတိုင်း ရောင်းကောင်းလား\nweekly = s.groupby(s.index.dayofweek).mean()\n\n# ခန့်မှန်း = trend နောက်ဆုံး + ရက်အလိုက် ပုံစံ\nforecast = trend.iloc[-1] * weekly / weekly.mean()\n# ပိုတိကျချင်ရင် — Prophet, ARIMA, LSTM",
  },
  "ai-decision-trees": {
    heading: "လက်တွေ့ — tree ဆောက်ပြီး ဖတ်",
    body: "Decision tree က ရှင်းပြလို့ရတဲ့ model — စည်းမျဉ်းထုတ်ကြည့်။",
    code: "from sklearn.tree import DecisionTreeClassifier, export_text\n\ntree = DecisionTreeClassifier(max_depth=3)\ntree.fit(X, y)\n\nprint(export_text(tree, feature_names=[\"temp\",\"rh\",\"ec\"]))\n# |--- rh <= 82.5\n# |   |--- class: ကျန်းမာ\n# |--- rh >  82.5\n# |   |--- temp <= 24.1 → class: မှိုတက်\n# → \"စိုထိုင်း 82% ကျော် + အေး = မှို\" — လူနားလည်တဲ့ rule",
  },
  "ai-gradient-descent": {
    heading: "လက်တွေ့ — GD ကို ကိုယ်တိုင်ရေး",
    body: "Library မသုံးဘဲ linear regression ကို GD နဲ့ သင်ကြည့်။",
    code: "w, b, lr = 0.0, 0.0, 0.01\n\nfor epoch in range(200):\n    y_pred = [w*x + b for x in X]\n    # gradient — loss ကို w, b အလိုက် အနုကြိမ်း\n    dw = sum(2*(yp-yt)*x  for yp,yt,x in zip(y_pred,y,X)) / len(X)\n    db = sum(2*(yp-yt)    for yp,yt   in zip(y_pred,y))   / len(X)\n    w -= lr * dw           # လျှောဆင်းရာဘက် လှမ်း\n    b -= lr * db\n\nprint(f\"y = {w:.2f}x + {b:.2f}\")",
  },
  "ai-loss-function": {
    heading: "လက်တွေ့ — MSE ကိုယ်တိုင်တွက်",
    body: "ခန့်မှန်းချက် ဘယ်လောက်လွဲလဲ ဂဏန်းတစ်လုံးနဲ့ ဖော်ပြခြင်း။",
    code: "def mse(y_true, y_pred):\n    \"\"\"Mean Squared Error — regression သုံး\"\"\"\n    return sum((t - p) ** 2\n               for t, p in zip(y_true, y_pred)) / len(y_true)\n\nactual    = [62, 58, 65, 60]   # တကယ့် ရိတ်ရက်\npredicted = [60, 59, 70, 61]\nprint(mse(actual, predicted))  # 7.75\n# နှစ်ထပ်ကိန်းမို့ — အလွဲကြီးကို ပိုပြင်းပြင်း ဒဏ်ပေး",
  },
  "ai-train-test-split": {
    heading: "လက်တွေ့ — မှန်ကန်စွာ ခွဲနည်း",
    body: "Split လုပ်ရာမှာ မှားတတ်တဲ့ ထောင်ချောက်နှစ်ခုပါ ရှောင်နည်း။",
    code: "from sklearn.model_selection import train_test_split\n\nX_tr, X_te, y_tr, y_te = train_test_split(\n    X, y,\n    test_size=0.2,\n    random_state=42,   # ထပ်ခါ run လည်း တူ (reproducible)\n    stratify=y,        # class အချိုး နှစ်ဖက်တူ\n)\n\n# ⚠️ ထောင်ချောက် ၁: scaler ကို train ပေါ်မှာပဲ fit\n# ⚠️ ထောင်ချောက် ၂: time series — ကျပန်းမခွဲရ,\n#    အတိတ်နဲ့သင် အနာဂတ်နဲ့စစ် (data leakage ရှောင်)",
  },
  "ai-precision-recall": {
    heading: "လက်တွေ့ — ကိုယ်တိုင်တွက်ကြည့်",
    body: "TP/FP/FN ကနေ precision, recall, F1 ထုတ်နည်း။",
    code: "TP, FP, FN, TN = 45, 10, 5, 40\n\nprecision = TP / (TP + FP)    # ရှိတယ်ပြောတာထဲ မှန်နှုန်း\nrecall    = TP / (TP + FN)    # တကယ်ရှိတာထဲ ဖမ်းမိနှုန်း\nf1 = 2 * precision * recall / (precision + recall)\n\nprint(f\"P={precision:.0%} R={recall:.0%} F1={f1:.0%}\")\n# P=82% R=90% F1=86%\n# ပိုးရောဂါ — recall အရေးကြီး (လွတ်ရင် ကူးစက်)\n# spam filter — precision အရေးကြီး (မှားဖမ်းရင် စိတ်ညစ်)",
  },
  "ai-vector-database": {
    heading: "လက်တွေ့ — pgvector နဲ့ ရှာ",
    body: "Supabase/Postgres ရဲ့ pgvector နဲ့ အဓိပ္ပာယ်တူ ရှာခြင်း။",
    code: "-- pgvector extension (Supabase မှာ ပါပြီးသား)\ncreate table docs (\n  id uuid primary key,\n  content text,\n  embedding vector(1536)\n);\n\n-- အနီးဆုံး ၅ ခု (cosine distance)\nselect content\nfrom docs\norder by embedding <=> query_embedding\nlimit 5;",
  },
  "ai-explainability": {
    heading: "လက်တွေ့ — feature importance",
    body: "Model က ဘာကိုကြည့်ပြီး ဆုံးဖြတ်လဲ ထုတ်ကြည့်ခြင်း။",
    code: "import pandas as pd\n\nmodel.fit(X, y)\nimp = pd.Series(model.feature_importances_,\n                index=X.columns).sort_values()\nprint(imp)\n# light_hours    0.08\n# avg_temp       0.21\n# avg_humidity   0.28\n# avg_ec         0.43  ← EC က အဓိက!\n\n# တစ်ခုချင်း ခန့်မှန်းချက် ရှင်းချင်ရင် — SHAP library",
  },
  "ai-edge-ai": {
    heading: "လက်တွေ့ — TFLite ဖုန်း/board ပေါ်သုံး",
    body: "Model ချုံ့ပြီး internet မလိုဘဲ စက်ပေါ်မှာ run ခြင်း။",
    code: "import tensorflow as tf\n\n# ၁။ model ကို TFLite ပြောင်း + ချုံ့ (quantize)\nconv = tf.lite.TFLiteConverter.from_keras_model(model)\nconv.optimizations = [tf.lite.Optimize.DEFAULT]\nopen(\"leaf.tflite\", \"wb\").write(conv.convert())\n# 15MB → 4MB — Raspberry Pi/ဖုန်းမှာ ဆံ့\n\n# ၂။ စက်ပေါ်မှာ run — internet မလို\ninterp = tf.lite.Interpreter(\"leaf.tflite\")\n# လယ်ကွင်းထဲ signal မမီလည်း ရောဂါစစ်နိုင်",
  },
  "ai-mlops": {
    heading: "လက်တွေ့ — ML lifecycle",
    body: "Model က တစ်ခါသင်ပြီးတိုင်း မပြီး — ပတ်လည် စက်ဝန်း။",
    code: "# MLOps စက်ဝန်း\n# ─────────────────────────────\n# ၁။ Data စု + version (DVC)\n# ၂။ Train + experiment မှတ် (MLflow)\n# ၃။ Test — accuracy ဘောင်ကျော်မှ ထုတ်\n# ၄။ Deploy — API/edge\n# ၅။ Monitor — drift စောင့်ကြည့်\n#    (ရာသီပြောင်းရင် data ပုံစံပြောင်း → accuracy ကျ)\n# ၆။ Retrain — data အသစ်နဲ့ ပြန်သင် → ၃ သို့\n# ─────────────────────────────",
  },
  "ai-project-classifier": {
    heading: "လက်တွေ့ — project အပြည့်",
    body: "Data ဖတ် → သင် → စစ် → သိမ်း — classifier project တစ်ခုလုံး။",
    code: "import pandas as pd, joblib\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.metrics import classification_report\n\ndf = pd.read_csv(\"plant_health.csv\")\nX, y = df.drop(columns=\"status\"), df[\"status\"]\nX_tr, X_te, y_tr, y_te = train_test_split(\n    X, y, test_size=0.2, stratify=y, random_state=42)\n\nmodel = RandomForestClassifier(n_estimators=200)\nmodel.fit(X_tr, y_tr)\nprint(classification_report(y_te, model.predict(X_te)))\n\njoblib.dump(model, \"plant_health.joblib\")  # ထုတ်သုံးရန် သိမ်း",
  },
};

/** Merge diagrams and code sections into the AI lessons. */
export function enrichAiLessons(lessons: Lesson[]): Lesson[] {
  return enrichLessons(lessons, IMAGES, CODE);
}
