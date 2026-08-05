# P7 — gwave Production Deployment Guide
Local dev မှာ test pass ပြီးသား P7 code ကို AWS ပေါ်တင်နည်း (မင်း credentials နဲ့ Claude Code မှာလုပ်ရန်)

## 1. Cognito SSO (7.1)
gwave.ai auth migration က Cognito သုံးမယ်ဆိုထားပြီးသား — user pool တစ်ခုတည်း share:
```bash
# server env (EC2)
AUTH_MODE=cognito
AWS_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=<gwave pool id>
COGNITO_CLIENT_ID=<game app client id>   # pool ထဲ app client အသစ် "gwave-game"
```
- gwave.cc → game launch link: `https://game.gwave.cc/?token=<id_token>` (session ကနေထည့်ပေး)
- Avatar GLB: Cognito custom attribute `custom:avatar_glb` = S3 URL → client auto-load ပြီးသား
- Token refresh: client မှာ 50min တိုင်း gwave.cc `/api/session` ကနေ token အသစ်ယူ (TODO client hook)

## 2. RDS Schema (7.2)
```bash
psql "$DATABASE_URL" -f server/migrations/001_game_schema.sql
# api server env:
DATABASE_URL=postgres://...gwave-rds.../gwave
GAME_KEY=<random 32-char secret>        # game server ↔ api shared
```
api.js က DATABASE_URL တွေ့ရင် Postgres အလိုအလျောက်သုံး (memory fallback မလိုတော့)

## 3. EC2 Deploy (game + api)
```bash
# t3.medium, ap-southeast-1, Ubuntu 24
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
cd /opt/gwave-game/server && npm install
# pm2 process ၂ ခု
pm2 start server.js --name game -- AUTH_MODE=cognito ...
pm2 start api.js --name api
pm2 save && pm2 startup
```
**nginx (game.gwave.cc):**
```nginx
server {
  server_name game.gwave.cc;
  location / { root /opt/gwave-game; try_files $uri /index.html; }
  location /ws  { proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade"; }
  location /api/ { proxy_pass http://127.0.0.1:8788/; }
}
# certbot --nginx -d game.gwave.cc
```
Client URL params: `?server=wss://game.gwave.cc/ws&api=https://game.gwave.cc/api`

## 4. Assets → S3 + CloudFront
- GLB/KTX2/audio → `s3://gwave-game-assets` + CloudFront (index.html က CDN URL)
- Avatar scans: `s3://gwave-avatars/{sub}/avatar.glb` (gwave scan pipeline output)

## 5. IVS Spectate (7.7)
- Match room start → IVS channel create (Lambda) → broadcaster = spectator headless client (EC2, puppeteer + canvas capture) သို့ ကစားသမား client-side capture
- Playback URL ကို gwave Live tab feed ထဲထည့် (`live_streams` table ရှိပြီးသား)
- Auto-record-to-S3 (gwave Live replay decision နဲ့တစ်သားတည်း)

## 6. Marketplace / G-Pay (7.8)
- `game.items` seed → gwave Marketplace မှာ category "Game Items"
- Purchase flow: gwave G-Pay checkout → webhook → `game.inventory` insert → client `/me/inventory` (endpoint ထပ်ထည့်ရန် TODO)

## 7. OpenClaw NPC (7.9)
- openclaw.gwave.cc မှာ `/game/npc` route: system persona server-side ထည့်ပြီး Anthropic API proxy (API key server ထဲသာ)
- Client: `?ai=https://openclaw.gwave.cc/game/npc` — offline fallback ရှိပြီးသား

## 8. WebTransport Upgrade (P5 → production)
- Node: `@fails-components/webtransport` သို့ Go quic-go sidecar :4433
- server.js ရဲ့ send/broadcast ၂ function သာ transport ထိ — datagram channel = 'u'/'s' messages, reliable stream = kill/chat
- Fallback ladder: WebTransport → WebSocket (NetClient မှာ auto-detect TODO)

## Checklist
- [ ] Cognito app client + custom:avatar_glb attribute
- [ ] RDS migration run
- [ ] EC2 + pm2 + nginx + TLS (game.gwave.cc DNS)
- [ ] S3/CloudFront assets
- [ ] GAME_KEY secret rotate
- [ ] gwave.cc launch button (?token= hand-off)
- [ ] Security group: 443 only (8787/8788 internal)
