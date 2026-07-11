// AI course — third batch (30 → 60). Reading lessons with a YouTube video hint
// and three Burmese sections each, covering deep learning, LLM mechanics,
// prompting, classic ML and applied AI (with farming examples where natural).
// Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

function rd(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  sections: [string, string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "reading",
    youtubeQuery,
    sections: sections.map(([heading, body]) => ({ heading, body })),
  };
}

export const AI_EXTRA2: Lesson[] = [
  rd("ai-deep-learning", "Deep Learning", "အလွှာများစွာ neural network — modern AI ရဲ့ အခြေခံ။", 9, "what is deep learning explained", [
    ["deep ဆိုတာ", "Deep learning က neural network ကို အလွှာ (layer) များစွာ ဆင့်ထားခြင်း — 'deep' ဆိုတာ အလွှာ များတယ်လို့ ဆိုလိုသည်။ အလွှာတစ်ခုစီက ရိုးရှင်းတဲ့ feature ကနေ ရှုပ်ထွေးတဲ့ pattern အထိ တဖြည်းဖြည်း သင်ယူသည်။"],
    ["ဘာကြောင့် အားကောင်း", "အလွှာနည်းတဲ့ model တွေ မလုပ်နိုင်တဲ့ ရှုပ်ထွေးတဲ့ အလုပ်များ (ပုံမှတ်, အသံ, ဘာသာစကား) ကို deep learning က ကိုင်တွယ်နိုင်သည်။ data များ, compute များ ရလာမှ ဒါ ဖြစ်လာနိုင်ခဲ့သည်။"],
    ["အသုံးချ", "ပုံမှ ရောဂါ ရှာ (အပင်အရွက် ရောဂါ), အသံ မှ စာ, ဘာသာပြန်, chatbot — ယနေ့ခေတ် AI feature အားလုံးနီးပါး deep learning အပေါ် တည်သည်။"],
  ]),
  rd("ai-cnn", "Convolutional Networks (CNN)", "ပုံ/ရုပ်ပုံ နားလည်တဲ့ neural network။", 10, "convolutional neural network explained", [
    ["CNN ဆိုတာ", "CNN က ပုံများကို filter (kernel) များနဲ့ 'scan' လုပ်၍ အနား, ပုံသဏ္ဌာန်, texture စတဲ့ feature များ ရှာဖွေတတ်တဲ့ network — ကွန်ပျူတာ မြင်စွမ်း (computer vision) ရဲ့ အခြေခံ။"],
    ["ဘယ်လို အလုပ်လုပ်", "ရှေ့အလွှာက အနားလို ရိုးရှင်းတာ, နောက်အလွှာက မျက်လုံး/အရွက်လို ရှုပ်ထွေးတာ, နောက်ဆုံးက 'ဒါ ကြောင်/အပင်' လို ခွဲခြားသည် — feature များ တဖြည်းဖြည်း ဆင့်ကဲ။"],
    ["စိုက်ပျိုးရေး", "အပင်အရွက် ဓာတ်ပုံကနေ ရောဂါ/ပိုးမွှား ရှာဖွေခြင်း, အသီးအနှံ အရွယ်အစား ခွဲခြားခြင်း — CNN နဲ့ တောင်သူများ အလုပ်ဖြစ်နိုင်တဲ့ ဥပမာ။"],
  ]),
  rd("ai-rnn-lstm", "RNN နဲ့ LSTM", "အစီအစဉ်ရှိ data (စာ, အချိန်) အတွက် network။", 9, "RNN LSTM explained sequence", [
    ["sequence data", "RNN (Recurrent Neural Network) က အစီအစဉ်ရှိတဲ့ data — စာကြောင်း, အသံ, အချိန်ဆိုင်ရာ sensor reading — ကို ကိုင်တွယ်ရန် ဒီဇိုင်းထုတ်ထားသည်။ ယခင် input ကို 'မှတ်' ထားနိုင်။"],
    ["LSTM", "ရိုးရိုး RNN က အဝေးက အချက်အလက်ကို မေ့တတ်သည်။ LSTM (Long Short-Term Memory) က 'gate' စနစ်နဲ့ ဘယ်အရာ မှတ်/မေ့မလဲ ထိန်းချုပ်လို့ ကြာရှည် pattern များ မှတ်နိုင်။"],
    ["ယနေ့ခေတ်", "Transformer တွေ မလာမီ RNN/LSTM က NLP, ဘာသာပြန်တွေမှာ အဓိက ဖြစ်ခဲ့သည်။ ယခုတော့ transformer က နေရာ အများစု ယူထားပြီ ဖြစ်သော်လည်း time-series forecasting တွေမှာ ရှိဆဲ။"],
  ]),
  rd("ai-attention", "Attention Mechanism", "အရေးကြီးတဲ့ အပိုင်းကို အာရုံစိုက်ခြင်း။", 10, "attention mechanism explained AI", [
    ["attention ဆိုတာ", "attention က model ကို input ရဲ့ ဘယ်အပိုင်းက အရေးကြီးလဲ 'အာရုံစိုက်' စေသည်။ ဘာသာပြန်ရာမှာ စကားလုံးတစ်ခုကို ဘာသာပြန်ဖို့ မူရင်းစာကြောင်းရဲ့ ဘယ်စကားလုံးတွေ ကြည့်ရမလဲ ဆုံးဖြတ်ပေးသည်။"],
    ["self-attention", "စကားလုံးတစ်ခုစီက တခြားစကားလုံးအားလုံးနဲ့ ဆက်စပ်မှုကို တွက်သည် — 'it' ဆိုတာ ဘာကို ရည်ညွှန်းလဲ နားလည်စေသည်။ ဒါက transformer ရဲ့ အနှစ်သာရ။"],
    ["အကျိုး", "attention ကြောင့် model က ဝေးကွာတဲ့ ဆက်စပ်မှုများကို ဖမ်းယူနိုင်ပြီး တစ်ပြိုင်နက် (parallel) တွက်လို့ မြန်သည် — ChatGPT စတဲ့ LLM အားလုံးရဲ့ အခြေခံ။"],
  ]),
  rd("ai-tokenization", "Token နဲ့ Tokenization", "LLM က စာကို ဘယ်လို 'ဖတ်' လဲ။", 9, "tokenization LLM tokens explained", [
    ["token ဆိုတာ", "LLM က စာလုံးအပြည့် မဟုတ်ဘဲ 'token' (စကားလုံး သို့ စကားလုံးအပိုင်း) များအဖြစ် ဖတ်သည်။ ဥပမာ 'unhappy' က 'un' + 'happy' ၂ token ဖြစ်နိုင်။ token က model ရဲ့ အခြေခံ ယူနစ်။"],
    ["ဘာကြောင့် အရေးကြီး", "API ဈေးနှုန်း, context အကန့်အသတ် အားလုံး token နဲ့ တိုင်းတာသည်။ အင်္ဂလိပ်စာ ~၄ လုံးက ~၁ token, မြန်မာစာက token ပိုကုန်တတ်သည် (script ကြောင့်)။"],
    ["အသုံးချ", "prompt တိုအောင် ရေးခြင်းက token ချွေတာ၊ ကုန်ကျစရိတ် လျော့စေသည်။ token count ကို tool များနဲ့ ကြိုတွက်နိုင်သည်။"],
  ]),
  rd("ai-context-window", "Context Window", "model က တစ်ကြိမ်မှာ 'မှတ်' နိုင်တဲ့ ပမာဏ။", 8, "LLM context window explained", [
    ["context window", "context window က model က တစ်ကြိမ်တည်း ကြည့်နိုင်တဲ့ token အများဆုံး ပမာဏ — prompt + အဖြေ ပေါင်း။ ဒါကို ကျော်ရင် အစောပိုင်း အချက်အလက်များ 'မေ့' သွားသည်။"],
    ["အရွယ်အစား", "model အလိုက် ကွာသည် — အချို့က token ထောင်ဂဏန်း, အချို့က သိန်းဂဏန်း (စာအုပ်တစ်အုပ်စာ)။ ကြီးလေ ပိုမှတ်နိုင်လေ ဖြစ်ပေမဲ့ compute ပိုကုန်။"],
    ["အသုံးချ", "ရှည်လျားတဲ့ document နဲ့ အလုပ်လုပ်ရင် အပိုင်းလိုက် ခွဲ (chunking) ပြီး RAG နဲ့ လိုအပ်တဲ့ အပိုင်းသာ ထည့်ခြင်းက context window ကို ထိရောက်စွာ သုံးစေသည်။"],
  ]),
  rd("ai-temperature", "Temperature နဲ့ Sampling", "အဖြေ ဘယ်လောက် 'ဖန်တီးမှု' ရှိမလဲ ထိန်းချုပ်ခြင်း။", 8, "LLM temperature sampling explained", [
    ["temperature", "temperature က model ရဲ့ အဖြေ ဘယ်လောက် ကွဲပြားမလဲ ထိန်းသည်။ နိမ့် (0.2) ဆို တိကျ/ထပ်တလဲလဲ, မြင့် (0.9) ဆို ဖန်တီးမှုရှိ/မမျှော်လင့်နိုင်။"],
    ["ဘယ်အခါ ဘယ်လို", "ကုဒ်, အချက်အလက် ထုတ်ရာမှာ temperature နိမ့် (တိကျမှု လို)၊ ဖန်တီးရေး, idea brainstorm မှာ မြင့် (မတူညီမှု လို)။ အလုပ်အလိုက် ချိန်ညှိပါ။"],
    ["top-p / top-k", "temperature အပြင် 'top-p' (nucleus) နဲ့ 'top-k' က ရွေးချယ်စရာ စကားလုံးအစုကို ကန့်သတ်၍ အဖြေ အရည်အသွေးကို ထိန်းသည်။"],
  ]),
  rd("ai-fine-tuning", "Fine-tuning", "ရှိပြီးသား model ကို အထူးပြု လေ့ကျင့်ခြင်း။", 9, "fine-tuning LLM explained", [
    ["fine-tuning ဆိုတာ", "အခြေခံ model (pre-trained) ကို ကိုယ့်ရဲ့ သီးသန့် data နဲ့ ထပ်လေ့ကျင့်ပြီး အထူးပြု အလုပ် (ကုမ္ပဏီ လေသံ, နယ်ပယ်အထူး) ကို ကောင်းအောင် လုပ်ခြင်း။ အစကနေ လေ့ကျင့်စရာမလို။"],
    ["ဘယ်အခါ လို", "prompt နဲ့ မလုံလောက်တဲ့ တသမတ်တည်း ပုံစံ, format, tone လိုတဲ့အခါ။ ဒါပေမဲ့ data, compute, ကျွမ်းကျင်မှု လိုအပ်လို့ ရိုးရိုး prompt/RAG နဲ့ အရင်ကြိုးစားပါ။"],
    ["အခြားနည်းများ", "LoRA လို 'parameter-efficient' fine-tuning က model တစ်ခုလုံး မဟုတ်ဘဲ အပိုင်းအနည်းငယ်သာ ပြင်လို့ ပိုပေါ့ပါး၊ ကုန်ကျစရိတ် သက်သာသည်။"],
  ]),
  rd("ai-transfer-learning", "Transfer Learning", "သင်ယူထားပြီးသား ဗဟုသုတ ပြန်သုံးခြင်း။", 8, "transfer learning explained", [
    ["သဘော", "transfer learning က အလုပ်တစ်ခုအတွက် သင်ယူထားတဲ့ model ကို ဆက်စပ် အလုပ်အသစ်အတွက် ပြန်သုံးခြင်း — လူတစ်ယောက် စက်ဘီးစီးတတ်ရင် မော်တော်ဆိုင်ကယ် ပိုသင်လွယ်သလို။"],
    ["ဘာကြောင့် အသုံးဝင်", "အစကနေ လေ့ကျင့်ရင် data သန်းချီ, compute မြောက်မြားစွာ လိုသည်။ pre-trained model ကို အခြေခံပြီး data အနည်းငယ်နဲ့ fine-tune လုပ်ရုံနဲ့ ကောင်းတဲ့ ရလဒ် ရနိုင်။"],
    ["ဥပမာ", "ImageNet နဲ့ လေ့ကျင့်ထားတဲ့ CNN ကို အပင်ရောဂါ ဓာတ်ပုံ အနည်းငယ်နဲ့ fine-tune လုပ်ပြီး ကိုယ်ပိုင် ရောဂါရှာ model ဆောက်နိုင်သည်။"],
  ]),
  rd("ai-few-shot", "Few-shot Prompting", "ဥပမာ အနည်းငယ် ပြ၍ သင်ကြားခြင်း။", 8, "few shot prompting examples", [
    ["zero/one/few-shot", "zero-shot က ဥပမာ မပြဘဲ တိုက်ရိုက်မေး၊ few-shot က ဥပမာ ၂–၅ ခု ပြပြီးမှ မေး — model က ပုံစံကို ဥပမာကနေ 'သင်ယူ' ပြီး လိုက်လုပ်ပေးသည်။"],
    ["ဘယ်အခါ သုံး", "output format တိကျချင်တဲ့အခါ (JSON, ဇယား, tone) ဥပမာ ၂–၃ ခု ပြခြင်းက ရှင်းရှင်း ရေးတာထက် ပိုထိရောက်တတ်သည်။"],
    ["အကြံ", "ဥပမာများ ကွဲပြားစုံလင်စွာ ရွေးပါ — edge case ပါ ထည့်ပါ။ ဥပမာ များလွန်းရင် token ကုန်လို့ ၂–၅ ခုလောက် လုံလောက်တတ်သည်။"],
  ]),
  rd("ai-chain-of-thought", "Chain-of-Thought", "အဆင့်လိုက် တွေးခိုင်း၍ တိကျမှု တိုးခြင်း။", 8, "chain of thought prompting explained", [
    ["သဘော", "'အဆင့်လိုက် တွေးပြပါ' (let's think step by step) လို့ ခိုင်းလိုက်ရင် model က ချက်ချင်း အဖြေ မထုတ်ဘဲ အကြောင်းပြချက် အဆင့်ဆင့် ရေးပြီးမှ ကောက်ချက်ချသည် — သင်္ချာ, logic ပုစ္ဆာများမှာ တိကျမှု များစွာ တိုးသည်။"],
    ["ဘာကြောင့် အလုပ်ဖြစ်", "အဆင့်လိုက် ရေးတာက model ကို 'တွက်ချက်ချိန်' ပေးသလို ဖြစ်ပြီး အမှား လျော့စေသည်။ လူတစ်ယောက် စာရွက်ပေါ်မှာ တွက်သလိုပဲ။"],
    ["တိုးချဲ့", "self-consistency (အဖြေ များစွာ ထုတ်ပြီး အများဆုံးကို ယူ), tree-of-thought (ဖြစ်နိုင်ခြေ လမ်းကြောင်းများ စမ်း) စတဲ့ ပိုအဆင့်မြင့် နည်းများလည်း ရှိသည်။"],
  ]),
  rd("ai-system-prompt", "System Prompt", "AI ရဲ့ အခန်းကဏ္ဍနဲ့ စည်းမျဉ်း သတ်မှတ်ခြင်း။", 8, "system prompt LLM role explained", [
    ["system prompt", "system prompt က model ရဲ့ 'အခန်းကဏ္ဍ', လေသံ, စည်းမျဉ်းများကို ဦးစွာ သတ်မှတ်ပေးသည် — 'သင်သည် ကူညီတတ်တဲ့ စိုက်ပျိုးရေး ဆရာ ဖြစ်သည်' စသဖြင့်။ အသုံးပြုသူ message များအားလုံးအပေါ် သက်ရောက်သည်။"],
    ["ဘာထည့်သင့်", "အခန်းကဏ္ဍ, tone (ရိုးရိုး/ရင်းနှီး), format လိုအပ်ချက်, မလုပ်ရမယ့်အရာများ (guardrail), context။ gwave chatbot လို app များ ဒါကို သုံးသည်။"],
    ["အကန့်အသတ်", "system prompt က အားကောင်းပေမဲ့ 'jailbreak' နဲ့ ကျော်ဖြတ်နိုင်တတ်သည်။ လုံခြုံရေး/data စစ်ဆေးမှုကို server မှာလည်း ထားရမည်။"],
  ]),
  rd("ai-function-calling", "Function Calling / Tools", "AI ကို ပြင်ပ tool များ သုံးစေခြင်း။", 9, "LLM function calling tools explained", [
    ["သဘော", "LLM က တွက်ချက်, ရက်စွဲ, real-time data တွေ မတိကျတတ်။ function calling က model ကို ပြင်ပ tool (calculator, database, API, weather) များ 'ခေါ်' ခွင့်ပေး၍ တိကျတဲ့ အဖြေ ရစေသည်။"],
    ["ဘယ်လို အလုပ်လုပ်", "tool များရဲ့ ဖော်ပြချက် ပေးထားရင် model က 'ဒီမေးခွန်းအတွက် weather API ခေါ်သင့်' ဆုံးဖြတ်ပြီး parameter ထုတ်ပေးသည်။ app က tool ကို run, ရလဒ်ကို model ဆီ ပြန်ပေး၊ model က အဖြေ ရေးသည်။"],
    ["agent", "tool များစွာ + loop ပေါင်းရင် 'agent' ဖြစ်လာသည် — အလုပ်တစ်ခုကို အဆင့်များစွာ ကိုယ်တိုင် စီစဉ် လုပ်ဆောင်နိုင်။ gwave ရဲ့ AI feature များ ဒီ pattern သုံးနိုင်။"],
  ]),
  rd("ai-multimodal", "Multimodal AI", "စာ, ပုံ, အသံ ပေါင်းစပ် နားလည်ခြင်း။", 8, "multimodal AI explained", [
    ["multimodal", "multimodal model က input အမျိုးအစားများစွာ (စာ + ပုံ + အသံ + ဗီဒီယို) ကို တစ်ပြိုင်နက် နားလည်နိုင်သည် — ပုံကြည့်ပြီး ဖော်ပြ, chart ဖတ်, အသံ နားထောင်။"],
    ["ဥပမာ", "အပင်ဓာတ်ပုံ ရိုက်ပြီး 'ဒါ ဘာရောဂါလဲ, ဘယ်လို ကုသရမလဲ' မေးနိုင်၊ receipt ပုံကနေ data ထုတ်, ဗွီဒီယိုကို အကျဉ်းချုပ်။"],
    ["အနာဂတ်", "multimodal က AI ကို ပိုသဘာဝ, ပိုအသုံးဝင်စေသည် — မျက်စိ (vision), နား (audio), စကား (language) ပေါင်းစပ်ခြင်းက လူ့ဉာဏ်ရည်နဲ့ ပိုနီးစပ်လာ။"],
  ]),
  rd("ai-diffusion", "Diffusion Models", "ပုံ ဖန်တီးတဲ့ AI ဘယ်လို အလုပ်လုပ်လဲ။", 9, "diffusion models image generation explained", [
    ["သဘော", "diffusion model က 'noise' (ဆူညံ) ကနေ ပုံ တဖြည်းဖြည်း ရှင်းလင်း ဖန်တီးသည်။ လေ့ကျင့်ချိန်မှာ ပုံကို noise ထည့်ပြီး ပြန်ဖယ်နည်း သင်ယူသည် — အသုံးပြုချိန်မှာ noise ကနေ စ၍ ပုံ ဖန်တီး။"],
    ["text-to-image", "စာ (prompt) ကို guide အဖြစ်သုံးပြီး noise ကို ရှင်းရင်း prompt နဲ့ ကိုက်တဲ့ ပုံ ထုတ်သည် — Stable Diffusion, DALL-E, Midjourney အားလုံး ဒီနည်း။"],
    ["အသုံးချ", "ဈေးကွက် ဓာတ်ပုံ, ပိုစတာ, product mockup, ဒီဇိုင်း idea များ ဖန်တီးရာမှာ။ မူပိုင်ခွင့်နဲ့ ကျင့်ဝတ် (bias, deepfake) ကို သတိထားပါ။"],
  ]),
  rd("ai-gans", "GANs", "မွေးစား/မွေးရင်း ယှဉ်ပြိုင်၍ ဖန်တီးခြင်း။", 8, "generative adversarial networks explained", [
    ["GAN ဆိုတာ", "GAN (Generative Adversarial Network) မှာ network ၂ ခု ယှဉ်ပြိုင်သည် — Generator က အတု ဖန်တီး, Discriminator က အစစ်/အတု ခွဲ။ တစ်ဦးကို တစ်ဦး ကောင်းအောင် တွန်းအားပေး၍ အလွန်ကောင်းတဲ့ အတု ဖြစ်လာ။"],
    ["အသုံးချ", "ဓာတ်ပုံ ဖန်တီး/ပြင်ဆင်, အရည်အသွေးမြှင့် (super-resolution), style transfer, synthetic data။ diffusion မလာမီ ပုံ ဖန်တီးရာမှာ အဓိက ဖြစ်ခဲ့။"],
    ["သတိ", "deepfake (မှားယွင်း ဗီဒီယို/ပုံ) ဖန်တီးရာမှာလည်း သုံးနိုင်လို့ ကျင့်ဝတ်နဲ့ လိမ်လည်မှု အန္တရာယ် ရှိသည် — တာဝန်သိသိ သုံးရန် လိုအပ်။"],
  ]),
  rd("ai-recommendation", "Recommendation Systems", "'သင် နှစ်သက်နိုင်သည်' အကြံပြုစနစ်။", 8, "recommendation systems explained", [
    ["သဘော", "recommendation system က အသုံးပြုသူ ကြိုက်နိုင်တာကို ခန့်မှန်းသည် — YouTube ရဲ့ 'next video', Shop ရဲ့ 'related products', feed ranking။"],
    ["နည်းလမ်း ၂ မျိုး", "content-based (ဆင်တူ item ရွေး) နဲ့ collaborative filtering (မင်းနဲ့တူသူတွေ ကြိုက်တာ ရွေး)။ ခေတ်မီ system တွေ နှစ်ခုလုံး ပေါင်း (hybrid) သုံးသည်။"],
    ["gwave", "feed ranking, shop product အကြံပြု, strain ဆင်တူ ရှာ — ဒီအားလုံး recommendation ရဲ့ ဥပမာ။ engagement (like, view) data ကနေ သင်ယူသည်။"],
  ]),
  rd("ai-anomaly-detection", "Anomaly Detection", "ပုံမှန်မဟုတ်တာ ရှာဖွေခြင်း။", 8, "anomaly detection machine learning", [
    ["သဘော", "anomaly detection က 'ပုံမှန်' ပုံစံ သင်ယူပြီး ၎င်းနဲ့ ကွဲထွက်တာ (anomaly) ကို ဖမ်းသည် — fraud, စက်ချို့ယွင်းမှု, ကွန်ရက် တိုက်ခိုက်မှု ရှာရာမှာ။"],
    ["ဘယ်လို", "labeled data နည်းတဲ့အခါ unsupervised နည်း (clustering, statistical) သုံး၍ 'များစုနဲ့ ကွာတာ' ကို anomaly အဖြစ် သတ်မှတ်။"],
    ["စိုက်ပျိုးရေး/farm", "sensor reading မှ ရုတ်တရက် ကွဲထွက်မှု (အပူချိန် ခုန်တက်, စိုထိုင်းဆ ကျ) ကို ဖမ်း၍ ပြဿနာ ကြိုသိစေနိုင် — smart farm alert ရဲ့ အခြေခံ။"],
  ]),
  rd("ai-forecasting", "Time-Series Forecasting", "အနာဂတ် တန်ဖိုး ခန့်မှန်းခြင်း။", 9, "time series forecasting explained", [
    ["သဘော", "အချိန်အလိုက် data (အရောင်း, ရာသီဥတု, ဈေးနှုန်း) ရဲ့ ပုံစံ (trend, ရာသီအလိုက်) ကို သင်ယူပြီး အနာဂတ်ကို ခန့်မှန်းခြင်း။"],
    ["နည်းလမ်းများ", "ရိုးရိုး (moving average) မှ ARIMA, Prophet, LSTM, transformer အထိ။ data ရဲ့ ပုံစံ ရှုပ်ထွေးမှုအလိုက် ရွေးသည်။"],
    ["အသုံးချ", "ရိတ်သိမ်း အထွက် ခန့်မှန်း, ဈေးကွက် ဝယ်လိုအား, inventory လိုအပ်ချက် ကြိုတွက် — တောင်သူ/ဈေးသည်များ စီမံခန့်ခွဲရာမှာ အသုံးဝင်။"],
  ]),
  rd("ai-decision-trees", "Decision Trees", "မေးခွန်း အဆင့်ဆင့်နဲ့ ဆုံးဖြတ်ခြင်း။", 8, "decision tree machine learning explained", [
    ["သဘော", "decision tree က 'yes/no' မေးခွန်း အဆင့်ဆင့်နဲ့ ဆုံးဖြတ်ချက် ချသည် — 'အရွက် ဝါလား? → အစက် ရှိလား? → ရောဂါ A'။ လူ နားလည်လွယ်တဲ့ model။"],
    ["အားသာ/အားနည်း", "အားသာ — ရှင်းလင်း, ဖတ်ရလွယ်, feature မရွေးရ။ အားနည်း — data နည်းနည်း ပြောင်းရင် ပုံစံ လွယ်လွယ် ပြောင်း (overfit)။"],
    ["ensemble", "tree များစွာ ပေါင်း (Random Forest, Gradient Boosting) ရင် တစ်ခုတည်းထက် အများကြီး တိကျ၊ တည်ငြိမ်လာသည် — နောက်သင်ခန်းစာ။"],
  ]),
  rd("ai-gradient-descent", "Gradient Descent", "model က 'သင်ယူ' တဲ့ နည်းလမ်း။", 9, "gradient descent explained simply", [
    ["သဘော", "gradient descent က model ရဲ့ အမှား (loss) ကို လျှော့ဖို့ parameter များကို တဖြည်းဖြည်း ချိန်ညှိတဲ့ နည်း — တောင်ကုန်းပေါ်က မြူထဲမှာ အနိမ့်ဆုံးဆီ တစ်လှမ်းချင်း ဆင်းသလို။"],
    ["learning rate", "တစ်လှမ်း ဘယ်လောက် ကြီးမလဲ ဆိုတာ 'learning rate'။ ကြီးလွန်းရင် ကျော်လွန်, ငယ်လွန်းရင် နှေး — မှန်ကန်စွာ ချိန်ဆရသည်။"],
    ["အရေးကြီးပုံ", "neural network လေ့ကျင့်မှု အားလုံးနီးပါး gradient descent (နဲ့ ၎င်းရဲ့ မျိုးကွဲ Adam, SGD) အပေါ် တည်သည် — deep learning ရဲ့ အနှစ်သာရ။"],
  ]),
  rd("ai-loss-function", "Loss Function", "model ရဲ့ 'အမှား' ကို တိုင်းတာခြင်း။", 8, "loss function machine learning explained", [
    ["loss ဆိုတာ", "loss function က model ရဲ့ ခန့်မှန်းချက်နဲ့ အမှန်တန်ဖိုး ဘယ်လောက် ကွာလဲ တိုင်းတာသည်။ loss နည်းလေ model ကောင်းလေ — လေ့ကျင့်မှုက loss ကို လျှော့ဖို့။"],
    ["အမျိုးအစား", "regression (ဂဏန်း ခန့်မှန်း) အတွက် MSE (mean squared error), classification (အမျိုးအစား) အတွက် cross-entropy — အလုပ်အလိုက် သင့်တော်တဲ့ loss ရွေးရသည်။"],
    ["အသုံးချ", "loss ကို လေ့ကျင့်စဉ် ကြည့်ခြင်းက model သင်ယူနေ/မနေ, overfit ဖြစ်နေ/မဖြစ် သိစေသည် — training curve ကို စောင့်ကြည့်ရသည်။"],
  ]),
  rd("ai-train-test-split", "Train/Test Split", "model ကို ရိုးသားစွာ စစ်ဆေးခြင်း။", 8, "train test validation split explained", [
    ["ဘာကြောင့် လို", "model ကို လေ့ကျင့်ခဲ့တဲ့ data နဲ့ပဲ စစ်ရင် 'အလွတ်ကျက်' တာလား တကယ် 'နားလည်' တာလား မသိ။ ဒါကြောင့် data ကို train (လေ့ကျင့်) နဲ့ test (စစ်) ခွဲရသည်။"],
    ["validation set", "train / validation / test ၃ ပိုင်း — validation က model ရွေး/ချိန်ညှိရာမှာ, test က နောက်ဆုံး ရိုးသားတဲ့ အကဲဖြတ်ရာမှာ (တစ်ကြိမ်သာ)။"],
    ["overfitting", "train မှာ ကောင်း test မှာ ညံ့ရင် overfit (အလွတ်ကျက်) ဖြစ်နေ။ ဒါက ML ရဲ့ အခြေခံ ဂရုစိုက်စရာ။"],
  ]),
  rd("ai-precision-recall", "Precision နဲ့ Recall", "accuracy တစ်ခုတည်းနဲ့ မလုံလောက်ပုံ။", 9, "precision recall f1 explained", [
    ["ပြဿნာ", "ရောဂါ ၁% သာ ရှိတဲ့ data မှာ 'အားလုံး ကျန်းမာ' လို့ ခန့်မှန်းရင် accuracy ၉၉% — ဒါပေမဲ့ လုံးဝ အသုံးမဝင်။ ဒါကြောင့် precision, recall လိုအပ်။"],
    ["precision vs recall", "precision — 'ရောဂါ' ဟု ခန့်မှန်းထားတာထဲ တကယ် ရောဂါ ဘယ်နှစ်%။ recall — တကယ် ရောဂါ ရှိသူထဲ ဘယ်နှစ်% ကို ဖမ်းမိ။ တစ်ခု တိုးရင် တစ်ခု လျော့တတ်။"],
    ["F1 score", "precision နဲ့ recall ကို ဟန်ချက်ညီစွာ ပေါင်းတဲ့ တစ်ခုတည်းသော ဂဏန်း — မညီမျှတဲ့ (imbalanced) data အတွက် accuracy ထက် ပိုမှန်ကန်တဲ့ တိုင်းတာမှု။"],
  ]),
  rd("ai-vector-database", "Vector Database", "အဓိပ္ပာယ်အလိုက် ရှာဖွေမှုကို သိမ်းဆည်းခြင်း။", 9, "vector database explained", [
    ["သဘော", "vector database က embedding (data ရဲ့ ဂဏန်း ကိုယ်စားပြုမှု) များ သိမ်းပြီး 'အဓိပ္ပာယ်အလိုက် အနီးဆုံး' ကို မြန်ဆန်စွာ ရှာပေးသည် — keyword တူညီစရာ မလို။"],
    ["RAG နဲ့", "RAG (Retrieval-Augmented Generation) မှာ document များကို embed လုပ်၍ vector DB မှာ သိမ်း၊ မေးခွန်းနဲ့ အနီးဆုံး အပိုင်းများ ရှာ၍ LLM ကို ကျွေးသည် — ကိုယ်ပိုင် data နဲ့ chatbot ဆောက်ရာမှာ။"],
    ["ဥပမာ", "Pinecone, Weaviate, pgvector (Postgres)။ gwave ရဲ့ semantic search, strain ဆင်တူ ရှာဖွေမှုတွေမှာ ဒီ concept သုံးနိုင်။"],
  ]),
  rd("ai-explainability", "Explainable AI (XAI)", "AI ရဲ့ ဆုံးဖြတ်ချက်ကို နားလည်ခြင်း။", 8, "explainable AI XAI interpretability", [
    ["ပြဿနာ", "deep model များက 'black box' — အဖြေ ပေးပေမဲ့ ဘာကြောင့်လဲ ရှင်းမပြ။ ဆေးဘက်, ချေးငွေ, တရားရေး လို အရေးကြီးတဲ့ ဆုံးဖြတ်ချက်တွေမှာ ဒါ လက်မခံနိုင်။"],
    ["နည်းလမ်းများ", "SHAP, LIME လို tool များက 'ဘယ် feature က ဆုံးဖြတ်ချက်ကို ဘယ်လောက် လွှမ်းမိုးလဲ' ပြသည်။ decision tree လို ရိုးရှင်းတဲ့ model က သဘာဝအရ ရှင်းသည်။"],
    ["ဘာကြောင့် အရေးကြီး", "ယုံကြည်မှု, ဥပဒေ (EU AI Act), bias ရှာဖွေရေး, အမှား ပြင်ဆင်ရေးအတွက် explainability က မရှိမဖြစ် လိုအပ်လာသည်။"],
  ]),
  rd("ai-edge-ai", "Edge AI", "device ပေါ်မှာ တိုက်ရိုက် run တဲ့ AI။", 8, "edge AI on device explained", [
    ["edge ဆိုတာ", "edge AI က cloud server မဟုတ်ဘဲ device ကိုယ်တိုင် (ဖုန်း, camera, sensor) ပေါ်မှာ model ကို run ခြင်း — internet မလို, နှေးကွေးမှုမရှိ, data ကို device မှာ ထားလို့ privacy ကောင်း။"],
    ["အားသာ/အားနည်း", "အားသာ — မြန်, offline, privacy, ကုန်ကျစရိတ်နည်း။ အားနည်း — device ရဲ့ compute အကန့်အသတ်ကြောင့် model သေးရ, အားနည်းရ။"],
    ["ဥပမာ", "ဖုန်းက မျက်နှာ unlock, camera က object detection, smart farm sensor က ချက်ချင်း ဆုံးဖြတ်ချက်။ မြန်မာ့ ကွန်ရက် အခြေအနေအတွက် edge AI က အထူး သင့်တော်။"],
  ]),
  rd("ai-mlops", "MLOps", "AI model ကို ထုတ်လုပ်မှုအဆင့် စီမံခြင်း။", 8, "MLOps machine learning operations explained", [
    ["MLOps ဆိုတာ", "MLOps က model ကို ဆောက်ရုံမက production မှာ deploy, စောင့်ကြည့်, update လုပ်တဲ့ လုပ်ငန်းစဉ်တစ်ခုလုံး — software ရဲ့ DevOps ကို ML အတွက် ချဲ့ထားခြင်း။"],
    ["ဘာတွေ ပါ", "data pipeline, model versioning, automated training/testing, deployment, monitoring (model ရဲ့ တိကျမှု ကျလာသလား စောင့်ကြည့်), retraining။"],
    ["ဘာကြောင့် လို", "model က data ပြောင်းလာရင် (data drift) တဖြည်းဖြည်း ညံ့လာတတ်သည်။ MLOps က ဒါကို ဖမ်း, ပြန်လေ့ကျင့်ပေး၍ ရေရှည် ယုံကြည်စိတ်ချရစေသည်။"],
  ]),
  rd("ai-ai-in-myanmar", "AI နဲ့ မြန်မာဘာသာ", "ဒေသတွင်း ဘာသာစကားအတွက် AI။", 8, "low resource language AI NLP", [
    ["low-resource language", "AI model အများစုက အင်္ဂလိပ်စာ data များစွာနဲ့ လေ့ကျင့်ထား၍ မြန်မာလို 'low-resource' ဘာသာစကားတွေမှာ အားနည်းတတ်သည် — data နည်း, tokenization ခက်။"],
    ["အခက်အခဲများ", "မြန်မာစာက ကွက်လပ်နဲ့ စကားလုံး မခွဲ, Unicode/Zawgyi ရောထွေး, dataset ရှားပါး — ဒါတွေက AI ရဲ့ တိကျမှုကို ထိခိုက်စေသည်။"],
    ["အခွင့်အလမ်း", "ဒေသတွင်း data စုဆောင်း, မြန်မာ fine-tuning, ကိုယ်ပိုင် dataset ဆောက်ခြင်းက မြန်မာအတွက် အသုံးဝင်တဲ့ AI ဖန်တီးရာမှာ အရေးပါ — gwave လို platform များ အခန်းကဏ္ဍ ရှိသည်။"],
  ]),
  rd("ai-project-classifier", "Project — အပင်ရောဂါ Classifier", "သင်ယူထားသမျှ ပေါင်း၍ AI project တစ်ခု စဉ်းစားခြင်း။", 10, "build image classifier project plan", [
    ["ပြဿনာ သတ်မှတ်", "အပင်အရွက် ဓာတ်ပုံကနေ ရောဂါ ခွဲခြားတဲ့ classifier ဆောက်မယ်ဆိုပါစို့။ ① data စုဆောင်း (ရောဂါအလိုက် ဓာတ်ပုံ) ② label တပ် ③ train/test ခွဲ။"],
    ["model ရွေး", "ပုံ ဖြစ်လို့ CNN (transfer learning နဲ့ pre-trained model fine-tune)။ data နည်းရင် transfer learning က အကောင်းဆုံး — အစကနေ လေ့ကျင့်စရာမလို။"],
    ["အကဲဖြတ် + deploy", "precision/recall/F1 နဲ့ စစ်, confusion matrix ကြည့်။ ကောင်းရင် edge (ဖုန်း) မှာ deploy ၍ တောင်သူများ offline သုံးနိုင်စေ — MLOps နဲ့ ရေရှည် စောင့်ကြည့်။ ဒါက applied AI ရဲ့ ပြည့်စုံတဲ့ လုပ်ငန်းစဉ်။"],
  ]),
];
