# Gwave — restore point နှင့် ပြန်လည်ရယူနည်း

AWS resource တစ်ခုမှ မဖျက်ခင် ဒီအဆင့်အားလုံး ပြီးအောင် လုပ်ပါ။
**မလုပ်ဘဲ ဘာမှ မဖျက်ပါနှင့်။**

လက်ရှိ production (အတည်ပြုပြီး):

| အရာ | တန်ဖိုး |
|---|---|
| App server | EC2 `i-0207c3c6180868996` · ap-southeast-1 |
| Public IP | `18.139.214.180` (gwave.cc + www.gwave.cc နှစ်ခုလုံး ဒီကို တိုက်ရိုက်) |
| Database | RDS `gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com` · db `gwave` |
| Image registry | ECR `gwave-web` · account `150897468627` |
| Load balancer | **မရှိ** — DNS က box ကို တိုက်ရိုက် ညွှန်နေသည် |

---

## အဆင့် ၁ — လက်ရှိအခြေအနေ မှတ်တမ်းတင်ပါ

EC2 box ပေါ်တွင်:

```bash
bash gwave-restore-point.sh
```

`~/gwave-restore-<ရက်စွဲ>/` အောက်တွင် အောက်ပါတို့ ရလာမည်:

- `host-state.txt` — running container များ၊ **image digest** (prod မှာ တကယ် run နေတဲ့ code အတိအကျ)၊ port များ
- `config-inventory.txt` — `/etc/gwave-web.env` ရဲ့ **variable နာမည်များသာ** (တန်ဖိုးများ မပါ — secret များ plain text ဖြစ်မသွားစေရန်)
- `aws-inventory.txt` — region ၃ ခုလုံးရှိ resource အားလုံး
- `dns.txt` — လက်ရှိ DNS
- `gwave-db.dump` — database logical backup (pg_dump custom format)

**ဒီ folder ကို box ပေါ်ကနေ ထုတ်ယူထားပါ။** Box ပျက်သွားရင် အထဲက အရာအားလုံး ပျောက်ပါလိမ့်မယ်:

```bash
# ကိုယ့်စက်ကနေ
scp -r ubuntu@18.139.214.180:~/gwave-restore-* .
```

---

## အဆင့် ၂ — Console မှာ snapshot ၃ ခု ယူပါ

CLI နဲ့ မလုပ်ဘဲ Console မှာ လုပ်ရတဲ့ အကြောင်းရင်း: `gwaveAppEc2Role` ကို AMI/snapshot ဖန်တီးခွင့် ပေးလိုက်ရင် — AMI ကို တခြား AWS account ဆီ ကူးလို့ရပြီး **အထဲက secret အားလုံး ပါသွား**နိုင်ပါတယ်။ Web app ရဲ့ role မှာ အဲဒီအခွင့်အရေး မရှိတာ ကောင်းပါတယ်။

### ၂.၁ RDS snapshot — user data (အရေးအကြီးဆုံး)

1. https://ap-southeast-1.console.aws.amazon.com/rds/home?region=ap-southeast-1#databases:
2. `gwave-db` → **Actions** → **Take snapshot**
3. နာမည်: `gwave-before-cleanup-YYYYMMDD`
4. **Status = Available** ဖြစ်သည်အထိ စောင့်ပါ (မိနစ် အနည်းငယ်)

> Post, message, order, mine site, map pin — user data အားလုံး ဒီထဲမှာ ရှိပါတယ်။ ဒါ မရှိရင် ပြန်ရစရာ မရှိပါ။

### ၂.၂ EC2 AMI — server တစ်ခုလုံး

1. https://ap-southeast-1.console.aws.amazon.com/ec2/home?region=ap-southeast-1#Instances:
2. `i-0207c3c6180868996` ကို ရွေး → **Actions** → **Image and templates** → **Create image**
3. နာမည်: `gwave-app-before-cleanup-YYYYMMDD`
4. **"No reboot" ကို အမှန်ခြစ်ပါ** ⚠️

> **No reboot ရဲ့ အကျိုးအပြစ်:** ခြစ်ထားရင် gwave.cc **မပိတ်ပါ**။ မခြစ်ရင် box က restart ဖြစ်ပြီး site ခဏ down ပါလိမ့်မယ်။ အပြစ်ကတော့ image ယူချိန်မှာ ရေးနေတဲ့ ဖိုင်တစ်ချို့ မပြည့်စုံနိုင်တာပါ။ Docker host အတွက်တော့ လက်ခံနိုင်ပါတယ် — အရေးကြီးတဲ့ data တွေက RDS နဲ့ S3 မှာ ရှိပြီးသားမို့ပါ။

ဒီ AMI ထဲမှာ ပါဝင်တာ: `/etc/gwave-web.env` (secret အားလုံး)၊ Caddy config၊ coturn config၊ `gwave-redeploy` script၊ docker setup — **အားလုံး**။ Box ပျက်ရင် ဒီ AMI ကနေ instance အသစ် launch လုပ်၊ Elastic IP ပြန်တွဲရုံနဲ့ ပြန်တက်ပါတယ်။

### ၂.၃ Lightsail snapshot — ဖျက်မယ့်ဟာတွေ

1. https://lightsail.aws.amazon.com/ls/webapp/ap-southeast-1/instances
2. https://lightsail.aws.amazon.com/ls/webapp/us-east-1/instances
3. Instance / Database / Container တစ်ခုချင်းစီ → **Snapshots** tab → **Create snapshot**
4. ပြီးမှသာ ဖျက်ပါ

> Snapshot က လစဉ် ဆင့်စ်အနည်းငယ်သာ ကုန်ပါတယ် (bundle ခ $23 ထက် များစွာ သက်သာ)။ လအနည်းငယ် ထားပြီးမှ ဖျက်ပါ။

---

## အဆင့် ၃ — snapshot တွေ တကယ် ရပြီလား စစ်ပါ

**ဒါ မစစ်ဘဲ ဘာမှ မဖျက်ပါနှင့်။** "Creating" state က backup မဟုတ်သေးပါ။

```bash
aws rds describe-db-snapshots --region ap-southeast-1 --snapshot-type manual \
  --query 'DBSnapshots[].[DBSnapshotIdentifier,Status,PercentProgress]' --output text

aws ec2 describe-images --region ap-southeast-1 --owners self \
  --query 'Images[].[ImageId,Name,State]' --output text
```

RDS = `available`၊ AMI = `available` နှစ်ခုလုံး ဖြစ်မှ ရှေ့ဆက်ပါ။

---

## ပြန်လည်ရယူနည်း — မှားသွားရင်

### Database ပြန်ရရန်
- **နည်း ၁ (မြန်):** RDS Console → Snapshots → `gwave-before-cleanup-…` → **Restore snapshot** → instance အသစ် တက်လာမည် → `/etc/gwave-web.env` ထဲက DB host ကို အသစ်ပြောင်း → `sudo gwave-redeploy`
- **နည်း ၂ (RDS လုံးဝ ပျောက်ရင်):** RDS အသစ် ဆောက်ပြီး logical dump ပြန်ထည့်ပါ:
  ```bash
  sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
    pg_restore -h <အသစ်> -U gwaveadmin -d gwave --no-owner --no-acl \
    < gwave-db.dump
  sudo docker restart postgrest
  ```

### App server ပြန်ရရန်
1. EC2 Console → AMIs → `gwave-app-before-cleanup-…` → **Launch instance from AMI**
2. Instance type နဲ့ security group ကို `aws-inventory.txt` ထဲက အတိုင်း တူအောင် ရွေးပါ
3. **Elastic IP `18.139.214.180` ကို instance အသစ်နဲ့ ပြန်တွဲပါ** — ဒါက DNS မပြောင်းဘဲ gwave.cc ပြန်တက်စေတဲ့ အချက်ပါ
4. `sudo gwave-redeploy` — ECR ကနေ image ပြန်ဆွဲပါလိမ့်မယ်
5. GitHub → repo Variables → `APP_INSTANCE_ID` ကို instance id အသစ်နဲ့ ပြောင်းပါ (မပြောင်းရင် deploy တွေ အလုပ်မလုပ်တော့ပါ)

### Code version ပြန်ရရန်
`host-state.txt` ထဲက image digest ကို သုံးပါ:
```bash
sudo docker pull 150897468627.dkr.ecr.ap-southeast-1.amazonaws.com/gwave-web@sha256:<digest>
```

### Lightsail ပြန်ရရန်
Lightsail Console → Snapshots → **Create new instance from snapshot**

---

## ဖျက်တဲ့အခါ လိုက်နာရမည့် စည်းမျဉ်း

1. **terminate/delete မလုပ်ခင် `stop` လုပ်ပါ။** EC2 instance ကို stop လုပ်ရင် compute ခ ရပ်သွားပြီး ပြန်ဖွင့်လို့ရပါတယ်။
2. **ရက် ၇ ရက် စောင့်ပါ။** gwave.cc၊ app၊ live၊ messenger၊ call အားလုံး ပုံမှန် အလုပ်လုပ်နေမှ terminate လုပ်ပါ။
3. **တစ်ခါတည်း တစ်ခုပဲ ဖျက်ပါ။** အများကြီး တစ်ပြိုင်နက် ဖျက်ရင် ဘယ်ဟာကြောင့် ပျက်သွားလဲ မသိတော့ပါ။
4. **ဒီ ၄ ခုကို ဘယ်တော့မှ မဖျက်ပါနှင့်:** EC2 `i-0207c3c6180868996` · Elastic IP `18.139.214.180` · RDS `gwave-db` · S3 bucket များ
