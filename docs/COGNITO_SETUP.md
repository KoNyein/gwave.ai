# Cognito User Pool ဆောက်နည်း — အဆင့်ဆင့် လမ်းညွှန်

**နည်းလမ်း:** Supabase **Third-Party Auth + Amazon Cognito** (fresh start)
**ဆိုလိုရင်း:** login ကိုပဲ Cognito ကို လွှဲ၊ Supabase Postgres + RLS + Realtime +
Storage + data အားလုံး **ဆက်သုံး**။ Supabase က Cognito ရဲ့ token ကို
ယုံကြည်အောင် config လုပ်ပြီး၊ token ထဲက `sub` က `auth.uid()` ဖြစ်လာမယ်။

> ဒီ doc က **AWS console/CLI မှာ ခင်ဗျား လုပ်ရမယ့် အပိုင်း**ပါ။ ပြီးရင်
> အဆုံးက **အချက် ၅ ခု** ကို ကျွန်တော်ဆီ ပြန်ပို့ပေးပါ — code (client auth,
> Supabase wiring, profiles FK migration) ကို ကျွန်တော် ရေးပါမယ်။

**Region:** `ap-southeast-1` (Singapore — မြန်မာနဲ့ အနီးဆုံး) ဟု ယူဆထားသည်။

---

## အကျဉ်းချုပ် — အဆင့် ၆ ဆင့်

| # | အဆင့် | ဘယ်မှာ |
|---|---|---|
| 1 | User Pool ဆောက် (email sign-in) | Cognito console |
| 2 | Hosted UI domain ဆောက် | Cognito console |
| 3 | Google ကို identity provider အဖြစ် ချိတ် | Cognito console |
| 4 | App Client ဆောက် (callback URL များ) | Cognito console |
| 5 | Supabase မှာ Cognito ကို Third-Party Auth ထည့် | Supabase dashboard |
| 6 | အချက် ၅ ခု ကျွန်တော်ဆီ ပြန်ပို့ | — |

---

# နည်းလမ်း ၁ — AWS Console (click-by-click)

## အဆင့် ၁ — User Pool ဆောက်

1. AWS Console → **Cognito** ရှာ → **Create user pool**
2. **Application type:** `Traditional web application` ရွေး
3. **Name:** `gwave-web`
4. **Sign-in identifiers:** `Email` ကို အမှန်ခြစ်
5. **Required attributes for sign-up:** `email`
6. **Return URL (callback):** `https://gwave.cc/auth/callback` ထည့်
7. **Create** နှိပ်

> Console ရဲ့ အသစ် "quick setup" က domain + app client ကို အလိုအလျောက်
> ဆောက်ပေးတတ်တယ်။ ဆောက်ပေးရင် အဆင့် ၂၊ ၄ ကို ကျော်လို့ရ — ဒါပေမယ့်
> အောက်က setting တွေ မှန်မမှန် ပြန်စစ်ပါ။

## အဆင့် ၂ — Hosted UI domain

Google federation အတွက် domain မဖြစ်မနေ လိုတယ်။

1. User Pool ထဲ → **Branding → Domain** (သို့ **App integration → Domain**)
2. **Cognito domain** ရွေး → prefix ထည့်: `gwave-auth`
3. Save → domain က ဒီလို ဖြစ်လာမယ်:
   ```
   https://gwave-auth.auth.ap-southeast-1.amazoncognito.com
   ```

## အဆင့် ၃ — Google ကို identity provider အဖြစ် ချိတ်

1. Google Cloud Console → **APIs & Services → Credentials** →
   ရှိပြီးသား **OAuth client ID** (web) ကို ဖွင့် (သို့ အသစ်ဆောက်)
2. **Authorized redirect URIs** မှာ ဒါ ထည့်:
   ```
   https://gwave-auth.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse
   ```
3. Google ရဲ့ **Client ID** + **Client secret** ကို ကူးထား
4. Cognito → User Pool → **Sign-in experience → Federated identity provider
   sign-in → Add identity provider → Google**
5. Google **client ID** + **client secret** ကို ကပ်
6. **Authorized scopes:** `openid email profile`
7. **Attribute mapping:** `email → email`, `name → name`, `picture → picture`
8. Save

## အဆင့် ၄ — App Client (callback / sign-out URL)

1. User Pool → **App integration → App clients → App client** ကို ဖွင့်
   (quick setup က ဆောက်ထားတာ) သို့ **Create app client**
2. **Client type:** `Confidential client` (server-side secret ရှိမယ်)
3. **App client name:** `gwave-web`
4. **Generate a client secret:** ✅ Yes
5. **Hosted UI settings:**
   - **Allowed callback URLs:**
     ```
     https://gwave.cc/auth/callback
     http://localhost:3000/auth/callback
     ```
   - **Allowed sign-out URLs:**
     ```
     https://gwave.cc/login
     http://localhost:3000/login
     ```
   - **Identity providers:** `Cognito user pool` + `Google` (နှစ်ခုလုံး ✅)
   - **OAuth grant types:** `Authorization code grant` ✅
   - **OpenID Connect scopes:** `openid`, `email`, `profile` ✅
6. Save

## အဆင့် ၅ — Email delivery (ယာယီ)

Fresh start မှာ user အသစ် register လုပ်ရင် Cognito က verify email ပို့ရမယ်။

1. User Pool → **Messaging → Email**
2. ယခုအတွက် **"Send email with Cognito"** (နေ့စဉ် ၅၀ စောင် အခမဲ့) ရွေးထားလို့ရ
3. Production မှာ → **Amazon SES** ချိတ်ပါ (နောက်မှ)

> ⚠️ **SMS/phone OTP မဖွင့်ပါနဲ့ဦး** — test အရ AWS SMS က မြန်မာကို မရောက်ပါ
> (`docs/AWS_MIGRATION_PLAN.md` §4)။ email + Google နဲ့ အရင်စပါ။

---

# နည်းလမ်း ၂ — AWS CLI (script)

> `aws configure` နဲ့ credential set ပြီးမှ run ပါ။ `YOUR_GOOGLE_CLIENT_ID` /
> `YOUR_GOOGLE_SECRET` ကို ကိုယ့်ဟာနဲ့ အစားထိုးပါ။

```bash
set -euo pipefail
REGION=ap-southeast-1

# 1) User Pool — email sign-in, email auto-verify, ရိုးရှင်းတဲ့ password policy
POOL_ID=$(aws cognito-idp create-user-pool \
  --region "$REGION" \
  --pool-name gwave-web \
  --username-attributes email \
  --auto-verified-attributes email \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":true,"RequireSymbols":false}}' \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":false}' \
  --query 'UserPool.Id' --output text)
echo "USER_POOL_ID=$POOL_ID"

# 2) Hosted UI domain (Google federation အတွက် လို)
aws cognito-idp create-user-pool-domain \
  --region "$REGION" --user-pool-id "$POOL_ID" --domain gwave-auth
echo "DOMAIN=https://gwave-auth.auth.$REGION.amazoncognito.com"

# 3) Google IdP
aws cognito-idp create-identity-provider \
  --region "$REGION" --user-pool-id "$POOL_ID" \
  --provider-name Google --provider-type Google \
  --provider-details client_id=YOUR_GOOGLE_CLIENT_ID,client_secret=YOUR_GOOGLE_SECRET,authorize_scopes="openid email profile" \
  --attribute-mapping email=email,name=name,picture=picture

# 4) App client (confidential, Authorization Code flow, callbacks)
CLIENT=$(aws cognito-idp create-user-pool-client \
  --region "$REGION" --user-pool-id "$POOL_ID" \
  --client-name gwave-web --generate-secret \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --callback-urls "https://gwave.cc/auth/callback" "http://localhost:3000/auth/callback" \
  --logout-urls "https://gwave.cc/login" "http://localhost:3000/login" \
  --supported-identity-providers COGNITO Google \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --query 'UserPoolClient.{id:ClientId,secret:ClientSecret}' --output json)
echo "APP_CLIENT=$CLIENT"

echo ""
echo "===== ကျွန်တော်ဆီ ပြန်ပို့ရမယ့် အချက်များ ====="
echo "USER_POOL_ID  = $POOL_ID"
echo "REGION        = $REGION"
echo "ISSUER_URL    = https://cognito-idp.$REGION.amazonaws.com/$POOL_ID"
echo "HOSTED_UI     = https://gwave-auth.auth.$REGION.amazoncognito.com"
echo "APP_CLIENT_ID + SECRET = (အထက်က APP_CLIENT json ထဲ)"
```

> ⚠️ Google redirect URI (အဆင့် ၃ ရဲ့ `.../oauth2/idpresponse`) ကို Google
> Cloud Console မှာ ကိုယ်တိုင် ထည့်ဖို့ မမေ့ပါနဲ့ — CLI က Google ဘက် setting
> ကို ပြင်လို့ မရပါ။

---

# အဆင့် ၅ — Supabase မှာ Cognito ကို ချိတ် (Third-Party Auth)

1. Supabase Dashboard (project `kspkzanfdblcjxgzzdjq`) →
   **Authentication → Sign In / Providers → Third-Party Auth** (သို့
   **Providers → Add provider → AWS Cognito**)
2. ဖြည့်ရန်:
   - **User Pool ID:** `ap-southeast-1_xxxxxxxxx`
   - **Region / AWS region:** `ap-southeast-1`
3. Save — ဒါဆို Supabase က ဒီ issuer
   `https://cognito-idp.ap-southeast-1.amazonaws.com/<POOL_ID>` ကနေ ထုတ်တဲ့
   token တိုင်းကို ယုံကြည်ပြီး၊ token ထဲက `sub` ကို `auth.uid()` အဖြစ်
   သတ်မှတ်ပေးမယ်။

---

# 🔑 ကျွန်တော်ဆီ ပြန်ပို့ရမယ့် အချက် ၅ ခု

ဒါတွေ ရပြီဆိုရင် code စ ရေးလို့ရပါပြီ —

| # | အချက် | ဥပမာ |
|---|---|---|
| 1 | **User Pool ID** | `ap-southeast-1_A1b2C3d4E` |
| 2 | **App Client ID** | `7abc...xyz` |
| 3 | **App Client Secret** | `1a2b3c...` (confidential client) |
| 4 | **Region** | `ap-southeast-1` |
| 5 | **Hosted UI domain** | `https://gwave-auth.auth.ap-southeast-1.amazoncognito.com` |

> Secret က server env မှာပဲ ထားမယ် (browser မရောက်)။ chat မှာ ပို့ရင်
> ပြီးတာနဲ့ Cognito console က **rotate** လုပ်ထားလို့ ရပါတယ်။

---

# ကျွန်တော် ဆက်လုပ်မယ့် code အပိုင်း (အချက် ၅ ခု ရရင်)

1. Cognito OIDC client (Authorization Code) — `login` / `register` /
   `signInWithGoogle` / `logout` ကို Cognito Hosted UI redirect သို့ ပြောင်း
2. `/auth/callback` — code → Cognito token exchange → Supabase client ကို
   Cognito access token feed
3. `profiles.id → auth.users` **FK ဖြုတ်** + profile auto-provision အသစ်
   (trigger မသုံးတော့ဘဲ server action က ဆောက်)
4. middleware — Cognito refresh token နဲ့ session refresh
5. env (`COGNITO_*`) + gates + staging test + deploy

**ခန့်မှန်း:** ~၃–၅ ရက် · Supabase data/RLS/Realtime/Storage **မထိ**
