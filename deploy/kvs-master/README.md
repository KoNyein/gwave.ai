# Amazon KVS WebRTC — real-time CCTV on gwave.cc

Show any RTSP CCTV on the website with **sub-second latency** using Amazon
Kinesis Video Streams (KVS) WebRTC. A small "master" box next to the camera
pushes its RTSP feed into a KVS **signaling channel**; the website joins as a
**viewer** and plays it peer-to-peer.

```
CCTV (RTSP) ──▶ Local master (this folder: GStreamer + KVS C SDK) ──▶ KVS channel ──▶ gwave.cc viewer
```

---

## အဆင့် ၁ — Signaling Channel ဆောက်ခြင်း (AWS Console)

1. AWS Console → **Kinesis Video Streams** → **Signaling channels** → **Create**.
2. နာမည်ပေးပါ (ဥပမာ `Hydroponics-Cam`)၊ region မှတ်ထားပါ (ဥပမာ `ap-southeast-1`)။

## အဆင့် ၂ — IAM Access Keys

1. AWS Console → **IAM → Users → Add user**။
2. Permission: **AmazonKinesisVideoStreamsFullAccess** (အနည်းဆုံး signaling channel access)။
3. **Security credentials** → **Access key** ထုတ်ပါ — `Access key ID` + `Secret access key` သိမ်းထားပါ။

> ⚠️ Secret key ကို ဘယ်တော့မှ chat/website/git ထဲ မထည့်ပါနဲ့ — server `.env` (သို့) master box `.env` မှာသာ ထားပါ။

## အဆင့် ၃ — Local Master (ဒီ folder) — RTSP → KVS

Camera နဲ့ တူညီတဲ့ network ထဲက Linux box (Ubuntu / Raspberry Pi) မှာ —

```bash
cd deploy/kvs-master
bash install.sh            # GStreamer + KVS WebRTC C SDK ကို build (တစ်ကြိမ်)
cp .env.example .env       # KVS_CHANNEL, RTSP_URL, AWS keys, region ဖြည့်ပါ
bash run-master.sh         # streaming စတင် — ဆက်ဖွင့်ထားပါ
```

24/7 ဆက်ဖွင့်ထားချင်ရင် (reboot ဖြစ်လည်း ပြန်စ) — systemd:

```bash
sudo cp deploy/kvs-master/kvs-master.service /etc/systemd/system/
sudo sed -i "s|__DIR__|$(pwd)/deploy/kvs-master|; s|__USER__|$USER|" \
  /etc/systemd/system/kvs-master.service
sudo systemctl daemon-reload
sudo systemctl enable --now kvs-master
journalctl -u kvs-master -f      # log ကြည့်ရန်
```

## အဆင့် ၄ — Website မှာ ကြည့်ခြင်း (auto)

Website ဘက်က ready ဖြစ်ပြီးသားပါ — server `.env` မှာ အောက်ပါ ၃ ခု ထည့်ပြီး redeploy လုပ်ပါ:

```
KVS_AWS_REGION=ap-southeast-1
KVS_AWS_ACCESS_KEY_ID=AKIA...
KVS_AWS_SECRET_ACCESS_KEY=...
```

ပြီးရင် **Cameras → Add camera → Amazon KVS** ကို ရွေး၊ channel name (region) ထည့်ပါ။
Camera စာမျက်နှာ ဖွင့်တာနဲ့ live ကြည့်ရပါမယ်။ Share link (`/watch/<token>`) ကနေ
public share လုပ်လို့လည်း ရပါတယ်။

**လုံခြုံရေး:** website က AWS secret ကို browser ဆီ တိုက်ရိုက် မပို့ပါ — server က
STS session token (၁ နာရီ) ထုတ်ပြီး viewer ကို ပေးတာမို့ long-lived key ဘယ်တော့မှ
client ဆီ မရောက်ပါ။

---

### Troubleshooting
- **Website မှာ "Can't reach the camera"** → master run နေမနေ (`journalctl -u kvs-master -f`)၊ server `.env` KVS keys/region မှန်မမှန်၊ channel name တူမတူ စစ်ပါ။
- **run-master.sh က args error** → SDK version အလိုက် arg order ကွဲနိုင်တယ် — `samples/README` ကြည့်ပါ (channel + `rtspsrc` + URL ပုံစံ)။
- **RTSP မဖွင့်နိုင်** → RTSP_URL ကို VLC နဲ့ အရင်စမ်းပါ (USER/PASS/IP မှန်ကြောင်း)။
