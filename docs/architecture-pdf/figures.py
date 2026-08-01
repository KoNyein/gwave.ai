"""Builds every figure used in the Gwave architecture document."""

from diagrams import (BRAND, INK, MUTED, LINE, arrow, elbow, er_free, er_hub,
                      label, node, sequence, svg, zone)

F = {}

# =============================================================== FIG 1 =======
# System context
b = []
b.append(zone(18, 44, 196, 300, "clients", "#c7d2fe"))
clients = [
    ("Web / PWA|gwave.cc", "browser, desktop + mobile"),
    ("Flutter app|Android APK", "mobile/ · 141 Dart files"),
    ("Public API|clients", "/api/v1 · scoped keys"),
    ("IoT + CCTV|devices", "MQTT · RTSP · KVS"),
]
for i, (t, s) in enumerate(clients):
    b.append(node(34, 70 + i * 66, 164, 50, t, "blue", sub=s, fs=9.4))

b.append(zone(248, 44, 214, 300, "edge + application", "#bcd9c9"))
b.append(node(264, 74, 182, 44, "Cloudflare", "grey", sub="DNS · WAF · CDN"))
b.append(node(264, 136, 182, 44, "Caddy (EC2)", "grey", sub="TLS · reverse proxy"))
b.append(node(264, 198, 182, 118, "Next.js 14|(standalone container)", "brand",
              sub="App Router · RSC · server actions"))
b.append(label(355, 300, "130+ pages · 111 API routes", 8.4, "#d7e8de", "middle", mono=True))

b.append(zone(496, 24, 386, 340, "platform services", "#f0d3a0"))
svcs = [
    (512, 52, "Amazon Cognito", "user pool ap-southeast-1_krSbdHFs9"),
    (512, 110, "PostgREST → RDS", "gwave.cc/sb/rest/v1"),
    (512, 168, "Realtime (OSS)", "gwave.cc/sb/realtime/v1"),
    (512, 226, "S3 + CloudFront", "media · chat · KYC buckets"),
    (512, 284, "AWS IVS / LiveKit", "live ingest, SFU, HLS"),
]
for x, y, t, s in svcs:
    b.append(node(x, y, 352, 46, t, "amber", sub=s, fs=9.6))

for i in range(4):
    b.append(arrow(198, 95 + i * 66, 262, 96 if i < 2 else 158))
b.append(arrow(355, 118, 355, 134))
b.append(arrow(355, 180, 355, 196))
for i, y in enumerate([75, 133, 191, 249, 307]):
    b.append(arrow(446, 240 if i > 2 else 230, 510, y))
F["context"] = svg(900, 380, b)

# =============================================================== FIG 2 =======
# AWS production topology
b = []
b.append(node(30, 24, 150, 40, "Users", "grey", sub="web · app · API"))
b.append(node(30, 84, 150, 40, "Cloudflare", "grey", sub="gwave.cc"))
b.append(arrow(105, 64, 105, 82))

b.append(zone(206, 12, 672, 470, "AWS · ap-southeast-1", "#bcd9c9"))
b.append(zone(222, 40, 330, 250, "EC2 app host (Amazon Linux + Docker)", "#c7d2fe"))
containers = [
    ("caddy", ":80 / :443 · TLS, /sb routing"),
    ("gwave-web", ":3000 Next.js standalone"),
    ("postgrest", ":3005 → RDS · JWKS verify"),
    ("realtime", ":4000 broadcast + changes"),
    ("coturn", ":3478 TURN relay 49160-49200"),
]
for i, (t, s) in enumerate(containers):
    b.append(node(238, 68 + i * 44, 298, 36, t, "blue", sub=s, fs=9.2))

b.append(node(586, 60, 274, 48, "Amazon RDS · PostgreSQL", "brand",
              sub="159 tables · RLS on every table"))
b.append(node(586, 120, 274, 44, "Amazon Cognito", "amber",
              sub="hosted UI · OIDC · custom:profile_id"))
b.append(node(586, 176, 274, 44, "S3 + CloudFront", "amber",
              sub="media (public) · chat + KYC (private)"))
b.append(node(586, 232, 274, 44, "AWS IVS (LL + Real-Time)", "amber",
              sub="RTMPS ingest · stage · composition"))
b.append(node(586, 288, 274, 44, "Kinesis Video Streams", "amber",
              sub="CCTV WebRTC signaling"))
b.append(node(586, 344, 274, 44, "ECR · SSM · CloudWatch", "grey",
              sub="image registry · deploy · metrics"))

b.append(node(222, 306, 330, 40, "Cost Explorer + CloudWatch metrics", "grey",
              sub="/admin/aws · /admin/storage dashboards"))
b.append(node(222, 360, 330, 40, "Secrets: /etc/gwave-web.env", "grey",
              sub="runtime env-file, never in the image"))
b.append(node(222, 414, 330, 40, "IAM instance role", "grey",
              sub="S3 · IVS · KVS · CE · no static keys"))

b.append(arrow(180, 104, 236, 104))
b.append(arrow(540, 112, 584, 84, "SQL"))
b.append(arrow(540, 140, 584, 142, "OIDC"))
b.append(arrow(536, 168, 584, 198, "presigned S3"))
b.append(arrow(536, 206, 584, 254, "SDK"))
b.append(arrow(536, 250, 584, 310, "signaling"))

b.append(node(30, 300, 150, 60, "LiveKit Cloud", "amber",
              sub="browser Go Live SFU"))
b.append(node(30, 380, 150, 60, "Stripe · Twilio|AliExpress · FCM", "amber",
              sub="external SaaS"))
b.append(arrow(180, 330, 236, 240, "WebRTC"))
b.append(arrow(180, 400, 236, 260, "HTTPS"))
F["aws"] = svg(900, 500, b)

# =============================================================== FIG 3 =======
F["auth"] = sequence(
    ["Browser /|Flutter app", "Next.js|server", "Amazon|Cognito", "PostgREST", "RDS|Postgres"],
    [
        (0, 2, "1. Hosted UI login / OIDC (or mobile JSON auth)"),
        (2, 0, "2. id + access + refresh token", "dashed"),
        (0, 1, "3. request with gw_at / gw_it / gw_rt cookies"),
        (1, 1, "verify Cognito JWT, resolve custom:profile_id"),
        (1, 1, "mint ES256 data token (APP_JWT_PRIVATE_KEY)"),
        (1, 3, "4. PostgREST call, Authorization: Bearer <ES256>"),
        (3, 3, "verify against JWKS (kid), set role=authenticated"),
        (3, 4, "5. SQL with request.jwt.claims.sub = profiles.id"),
        (4, 4, "row level security decides every row"),
        (4, 3, "6. rows the caller may see", "dashed"),
        (3, 1, "7. JSON", "dashed"),
        (1, 0, "8. rendered RSC payload / JSON", "dashed"),
    ], width=900)

# =============================================================== FIG 4 =======
# CI/CD web
b = []
b.append(node(24, 96, 128, 52, "Feature branch", "grey", sub="off main"))
b.append(node(180, 96, 128, 52, "Pull request", "grey", sub="required checks"))
b.append(node(336, 40, 150, 46, "Lint · Typecheck|· Build", "blue", sub="ci.yml / quality"))
b.append(node(336, 106, 150, 46, "Smoke E2E", "blue", sub="ci.yml / e2e-smoke"))
b.append(node(516, 96, 120, 52, "Squash merge|to main", "brand"))
b.append(node(666, 96, 210, 52, "deploy.yml", "soft",
              sub="push to main, paths-ignore **.md"))

b.append(arrow(152, 122, 178, 122))
b.append(arrow(308, 112, 334, 66))
b.append(arrow(308, 132, 334, 130))
b.append(arrow(486, 64, 514, 108))
b.append(arrow(486, 130, 514, 124))
b.append(arrow(636, 122, 664, 122))

b.append(node(24, 214, 200, 56, "docker build", "grey",
              sub="18 NEXT_PUBLIC_* build args"))
b.append(node(252, 214, 180, 56, "push to ECR", "grey",
              sub=":gwave and :<sha> tags"))
b.append(node(460, 214, 180, 56, "SSM send-command", "grey",
              sub="AWS-RunShellScript"))
b.append(node(668, 214, 208, 56, "sudo gwave-redeploy", "brand",
              sub="on the app EC2 instance"))
b.append(elbow(771, 148, 124, 212, via_y=182, label="build + deploy job"))
b.append(arrow(224, 242, 250, 242))
b.append(arrow(432, 242, 458, 242))
b.append(arrow(640, 242, 666, 242))

b.append(zone(24, 300, 852, 116, "gwave-redeploy on the box", "#f0d3a0"))
b.append(node(44, 336, 172, 60, "pull :gwave", "amber", sub="from ECR"))
b.append(node(238, 336, 172, 60, "canary on :3001", "amber",
              sub="health probe before swap"))
b.append(node(432, 336, 172, 60, "swap :3000", "amber",
              sub="--env-file /etc/gwave-web.env"))
b.append(node(626, 336, 230, 60, "auto-rollback on failure", "amber",
              sub="previous image stays warm"))
b.append(arrow(216, 366, 236, 366))
b.append(arrow(410, 366, 430, 366))
b.append(arrow(604, 366, 624, 366))
F["cicd"] = svg(900, 436, b)

# =============================================================== FIG 5 =======
# Mobile pipeline + branch model
b = []
b.append(node(24, 30, 190, 50, "push to mobile/**", "grey",
              sub="main or claude/** branch"))
b.append(node(240, 30, 200, 50, "build-flutter-apk.yml", "brand",
              sub="the only APK pipeline"))
b.append(node(466, 30, 190, 50, "flutter build apk", "grey",
              sub="--split-per-abi"))
b.append(node(682, 30, 194, 50, "sign with gwave-upload", "grey",
              sub="ANDROID_KEYSTORE_BASE64"))
b.append(arrow(214, 55, 238, 55))
b.append(arrow(440, 55, 464, 55))
b.append(arrow(656, 55, 680, 55))

b.append(node(24, 140, 190, 56, "versionCode = run #", "blue",
              sub="--dart-define=APP_BUILD"))
b.append(node(240, 140, 200, 56, "rolling release|mobile-latest", "blue",
              sub="one channel, always"))
b.append(node(466, 140, 190, 56, "gwave.cc/welcome", "blue",
              sub="/download/apk?abi="))
b.append(node(682, 140, 194, 56, "in-app update banner", "blue",
              sub="profiles.app_build heartbeat"))
b.append(elbow(779, 80, 119, 138, via_y=112))
b.append(arrow(214, 168, 238, 168))
b.append(arrow(440, 168, 464, 168))
b.append(arrow(656, 168, 680, 168))

b.append(zone(24, 232, 852, 128, "branch model", "#bcd9c9"))
b.append(node(60, 268, 190, 44, "main", "brand", sub="source of truth · auto-deploys"))
b.append(node(300, 262, 200, 26, "feat/* · fix/*", "grey", fs=9))
b.append(node(300, 296, 200, 26, "claude/phase-1-…-7ysxtj", "soft", fs=9))
b.append(node(560, 262, 300, 26, "short-lived → PR → squash merge", "grey", fs=9))
b.append(node(560, 296, 300, 26, "long-lived mobile dev branch (merge main in)", "soft", fs=9))
b.append(arrow(250, 276, 298, 274))
b.append(arrow(250, 296, 298, 306))
b.append(arrow(500, 275, 558, 275))
b.append(arrow(500, 309, 558, 309))
F["mobile"] = svg(900, 380, b)

# =============================================================== FIG 6 =======
# Live streaming paths
b = []
b.append(zone(18, 26, 424, 356, "path A · browser Go Live", "#c7d2fe"))
b.append(node(38, 60, 180, 46, "Browser camera", "blue", sub="getUserMedia"))
b.append(node(38, 124, 180, 46, "LiveKit room", "blue", sub="SFU, livekit_room"))
b.append(node(38, 188, 180, 46, "IVS Real-Time stage", "blue", sub="ivs-realtime.ts"))
b.append(node(38, 252, 180, 46, "composition", "blue", sub="mixes stage → LL channel"))
b.append(node(240, 124, 184, 110, "IVS Low-Latency|channel", "brand",
              sub="one HLS URL for everyone"))
b.append(node(38, 316, 386, 46, "web viewer (LiveKit SDK) + app viewer (HLS)", "blue",
              sub="/api/mobile/live/token self-heals stale rows"))
b.append(arrow(128, 106, 128, 122))
b.append(arrow(128, 170, 128, 186))
b.append(arrow(128, 234, 128, 250))
b.append(arrow(220, 268, 238, 205, "restream", lab_dy=14))

b.append(zone(458, 26, 424, 356, "path B · app broadcast", "#f0d3a0"))
b.append(node(478, 60, 180, 46, "Flutter camera", "amber", sub="RTMPS publisher"))
b.append(node(478, 124, 180, 46, "IVS ingest endpoint", "amber", sub="stream key from API"))
b.append(node(680, 60, 184, 110, "auto-record to S3", "amber",
              sub="IVS recording configuration"))
b.append(node(478, 188, 386, 46, "recording_path linked on end / verify", "amber",
              sub="latestIvsRecordingPath()"))
b.append(node(478, 252, 386, 46, "/api/live/recordings/sweep · 1-minute cron", "amber",
              sub="re-checks up to 24 h until the file appears"))
b.append(node(478, 316, 386, 46, "/recordings/[...path] replay proxy", "amber",
              sub="streamed through the domain, app + web"))
b.append(arrow(568, 106, 568, 122))
b.append(arrow(658, 115, 678, 115))
b.append(arrow(568, 170, 568, 186))
b.append(arrow(568, 234, 568, 250))
b.append(arrow(568, 298, 568, 314))
F["live"] = svg(900, 400, b)

# =============================================================== FIG 7 =======
F["call"] = sequence(
    ["Caller", "Realtime|calls:{callee}", "Next.js|/api/webrtc/ice", "coturn|TURN relay", "Callee"],
    [
        (0, 2, "1. GET ICE servers (TURN_URL / USERNAME / CREDENTIAL)"),
        (2, 0, "2. iceServers[]", "dashed"),
        (0, 1, "3. broadcast ring on calls:{userId}"),
        (1, 4, "4. ring delivered to the callee's inbox socket"),
        (4, 1, "5. accept on call:{callId}"),
        (0, 1, "6. SDP offer"),
        (1, 4, "7. SDP offer"),
        (4, 1, "8. SDP answer + ICE candidates"),
        (1, 0, "9. answer + candidates", "dashed"),
        (0, 3, "10. relay when direct P2P fails (carrier NAT)"),
        (3, 4, "11. media relayed both ways"),
        (0, 0, "hangup / decline → one call log row (echo-guarded)"),
    ], width=900)

# =============================================================== FIG 8 =======
# Ride state machine
b = []
states = [
    (30, 40, "requested", "grey"),
    (200, 40, "offered", "blue"),
    (370, 40, "accepted", "blue"),
    (540, 40, "arriving", "blue"),
    (710, 40, "in_progress", "brand"),
    (710, 150, "completed", "soft"),
    (370, 150, "cancelled", "amber"),
    (200, 150, "expired", "amber"),
]
for x, y, t, k in states:
    b.append(node(x, y, 148, 44, t, k))
for x in (178, 348, 518, 688):
    b.append(arrow(x, 62, x + 20, 62))
b.append(arrow(784, 84, 784, 148, "driver ends trip"))
b.append(arrow(444, 84, 444, 148, "either side", lab_dy=-4))
b.append(arrow(274, 84, 274, 148, "no answer"))
b.append(elbow(200, 172, 178, 62, via_x=140, label="re-dispatch"))

b.append(zone(24, 226, 852, 150, "server-side dispatcher", "#bcd9c9"))
b.append(node(44, 262, 190, 46, "POST /api/ride/request", "soft", sub="quote → ride row"))
b.append(node(254, 262, 190, 46, "ride_nearest_drivers()", "soft", sub="online + distance"))
b.append(node(464, 262, 190, 46, "ride_offers with countdown", "soft", sub="ride_accept_offer()"))
b.append(node(674, 262, 190, 46, "ride_guard_transition()", "soft", sub="illegal jumps rejected"))
b.append(node(44, 320, 400, 44, "GET /api/ride/{id} every 3 s = the dispatcher clock", "grey"))
b.append(node(464, 320, 400, 44, "ride:{rideId} broadcast = driver position between polls", "grey"))
b.append(arrow(234, 285, 252, 285))
b.append(arrow(444, 285, 462, 285))
b.append(arrow(654, 285, 672, 285))
F["ride"] = svg(900, 396, b)

# =============================================================== FIG 9 =======
F["post"] = sequence(
    ["Composer|(web / app)", "Server action|/api/posts", "S3 +|CloudFront", "RDS|(triggers)",
     "Realtime +|web-push"],
    [
        (0, 1, "1. draft: text, visibility, media handles"),
        (0, 2, "2. presigned PUT — bytes never pass through the app", "dashed"),
        (1, 3, "3. insert posts + post_media rows"),
        (3, 3, "can_view_post() enforces visibility on every read"),
        (3, 3, "bump_reaction_count / bump_comment_count triggers"),
        (3, 3, "notify_on_reaction / notify_on_comment / notify_on_share"),
        (3, 4, "4. notifications row → realtime postgres_changes"),
        (4, 0, "5. bell badge + web push to the recipient", "dashed"),
        (1, 3, "6. get_feed_boosts() injects paid boosts into the feed"),
        (3, 1, "7. keyset-paginated feed page", "dashed"),
    ], width=900)

# ============================================================== FIG 10 =======
# G-Pay money flow
b = []
b.append(zone(18, 24, 424, 200, "money in", "#c7d2fe"))
b.append(node(38, 58, 180, 42, "Stripe top-up", "blue", sub="gpay_stripe_topup()"))
b.append(node(38, 110, 180, 42, "admin slip top-up", "blue", sub="gpay_admin_topup()"))
b.append(node(38, 162, 180, 42, "currency convert", "blue", sub="currency_to_gpay()"))
b.append(node(244, 96, 180, 70, "gpay_accounts", "brand", sub="balance numeric(14,2)"))
for y in (79, 131, 183):
    b.append(arrow(218, y, 242, 131))

b.append(zone(458, 24, 424, 200, "money out", "#f0d3a0"))
b.append(node(680, 58, 184, 42, "gpay_transfer()", "amber", sub="user → user"))
b.append(node(680, 110, 184, 42, "pos_settle_gpay()", "amber", sub="POS sale"))
b.append(node(680, 162, 184, 42, "ride_driver_settle()", "amber", sub="commission owed"))
b.append(node(478, 96, 180, 70, "gpay_transactions", "amber",
              sub="from_account → to_account"))
b.append(arrow(424, 131, 476, 131))
for y in (79, 131, 183):
    b.append(arrow(658, 131, 678, y))

b.append(zone(18, 248, 864, 122, "controls", "#bcd9c9"))
b.append(node(38, 286, 196, 64, "gpay_protect_columns()", "soft",
              sub="balance is trigger-only, never a client write"))
b.append(node(250, 286, 196, 64, "gpay_pins + phone OTP", "soft",
              sub="gpay_set_pin · gpay_verify_phone_otp"))
b.append(node(462, 286, 196, 64, "face KYC + status gate", "soft",
              sub="gpay_set_status, private S3 bucket"))
b.append(node(674, 286, 190, 64, "RPCs locked down", "soft",
              sub="EXECUTE granted to service_role only"))
F["gpay"] = svg(900, 388, b)

# ============================================================== FIG 11 =======
# IoT / smart farm
b = []
b.append(node(24, 60, 160, 54, "Sensor / actuator", "grey", sub="ESP32, relays"))
b.append(node(212, 60, 160, 54, "EMQX MQTT broker", "blue", sub="per-device creds"))
b.append(node(400, 60, 160, 54, "iot-bridge (Node)", "blue", sub="services/iot-bridge"))
b.append(node(588, 60, 160, 54, "sensor_readings", "brand", sub="RDS, RLS by owner"))
b.append(node(776, 60, 100, 54, "/farm", "soft", sub="dashboard"))
for x in (184, 372, 560, 748):
    b.append(arrow(x, 87, x + 26, 87))

b.append(node(400, 156, 160, 50, "automation_rules", "amber", sub="threshold + cooldown"))
b.append(node(588, 156, 160, 50, "alerts", "amber", sub="notify_on_alert()"))
b.append(node(776, 156, 100, 50, "device_commands", "amber", sub="actuate"))
b.append(arrow(668, 114, 668, 154, "evaluate"))
b.append(arrow(560, 181, 586, 181))
b.append(arrow(748, 181, 774, 181))
b.append(elbow(826, 206, 292, 114, via_y=240, label="command published back over MQTT"))

b.append(node(24, 156, 160, 50, "scenes + schedules", "grey", sub="/home smart home"))
b.append(node(212, 156, 160, 50, "webhook_on_alert()", "grey", sub="HMAC-signed delivery"))
F["iot"] = svg(900, 270, b)

# ============================================================== FIG 12 =======
# Safety / SOS
b = []
b.append(node(24, 40, 172, 56, "SOS pressed", "brand",
              sub="app or web, one tap"))
b.append(node(224, 40, 172, 56, "sos_alerts row", "soft",
              sub="reason · phone · note"))
b.append(node(424, 40, 172, 56, "media attached", "soft",
              sub="photo · video · voice"))
b.append(node(624, 40, 252, 56, "optional Go Live", "soft",
              sub="the broadcast is the evidence"))
for x in (196, 396, 596):
    b.append(arrow(x, 68, x + 26, 68))

b.append(node(24, 136, 172, 56, "map danger banner", "amber",
              sub="/map + app map"))
b.append(node(224, 136, 172, 56, "sos_responders", "amber",
              sub="who is on the way"))
b.append(node(424, 136, 172, 56, "tiles dial / view media", "amber",
              sub="one tap to call"))
b.append(node(624, 136, 252, 56, "SMS + GPS fallback offline", "amber",
              sub="no internet still reaches someone"))
b.append(arrow(110, 96, 110, 134))
for x in (196, 396, 596):
    b.append(arrow(x, 164, x + 26, 164))

b.append(node(24, 232, 852, 46, "In-trip: ride SOS raises the same alert with plate, vehicle, driver and destination attached",
              "grey", sub="a help-me with no vehicle in it is the version nobody can act on"))
F["sos"] = svg(900, 292, b)

# ============================================================== FIG 13 =======
# Application layering
b = []
rows = [
    ("Presentation", "#e7f2ec", "src/app/**/page.tsx · src/components/** (34 domain folders) · Flutter screens"),
    ("Route handlers + server actions", "#eaf0ff", "src/app/api/** (111 routes) · src/lib/actions/** — auth, zod validation, orchestration"),
    ("Domain services", "#eaf0ff", "src/lib/db/** (44 modules) · src/lib/ivs·livekit·mux·gpay·ride·stripe·push·fcm"),
    ("Data access", "#fdf3e3", "src/lib/data/{client,server,admin,anon,middleware}.ts — PostgREST + Realtime clients"),
    ("Database", "#e7f2ec", "RDS PostgreSQL — 159 tables, RLS on every table, ~200 SQL functions, triggers"),
]
for i, (t, fill, s) in enumerate(rows):
    y = 24 + i * 60
    b.append(f'<rect x="24" y="{y}" width="852" height="48" rx="5" fill="{fill}" '
             f'stroke="{LINE}"/>')
    b.append(label(40, y + 20, t, 11, INK, weight="bold"))
    b.append(label(40, y + 36, s, 8.6, MUTED, mono=True))
    if i < len(rows) - 1:
        b.append(arrow(450, y + 48, 450, y + 60))
F["layers"] = svg(900, 330, b, bg="#ffffff")

# ============================================================== FIG 14 =======
# Module map
b = []
groups = [
    ("Social core", "#e7f2ec", ["feed · posts", "reactions · comments", "friends · follows",
                                "groups · pages", "stories · reels", "notifications"]),
    ("Communication", "#eaf0ff", ["messenger", "audio + video calls", "PTT channels",
                                  "live streaming", "co-host rooms", "meet rooms"]),
    ("Commerce", "#fdf3e3", ["shop · dropship", "affiliate", "POS (multi-store)",
                             "G-Pay wallet", "membership", "boosts (ads)"]),
    ("Knowledge", "#e7f2ec", ["strains", "minerals · mines", "metal market",
                              "learn (9 tracks)", "certificates", "search"]),
    ("Life services", "#eaf0ff", ["ride hailing", "jobs", "dating", "family GPS",
                                  "health", "wellness"]),
    ("Sensing + safety", "#fdf3e3", ["smart farm (IoT)", "CCTV", "drone radar",
                                     "WiFi mapping", "SOS + check-in", "threat alerts"]),
]
for i, (t, fill, items) in enumerate(groups):
    x = 24 + (i % 3) * 292
    y = 24 + (i // 3) * 216
    b.append(f'<rect x="{x}" y="{y}" width="272" height="196" rx="6" fill="{fill}" '
             f'stroke="{LINE}"/>')
    b.append(label(x + 14, y + 24, t, 11.5, INK, weight="bold"))
    for k, it in enumerate(items):
        b.append(label(x + 14, y + 48 + k * 22, "· " + it, 9.4, "#334155", mono=True))
F["modules"] = svg(900, 460, b, bg="#ffffff")

# ============================================================ ER DIAGRAMS ====
F["er_social"] = er_hub(
    "profiles", ["id uuid PK → auth.users", "username unique", "role user_role",
                 "last_seen_at", "app_build"],
    [
        ("posts", ["author_id →", "visibility", "shared_post_id ↺"], "1:N"),
        ("comments", ["post_id →", "parent_id ↺", "reply_count"], "1:N"),
        ("reactions", ["post_id | comment_id", "type reaction_type"], "1:N"),
        ("shares", ["original_post_id", "share_post_id"], "1:N"),
        ("post_media / post_views", ["post_id →", "viewer_id →"], ""),
        ("stories / story_views", ["author_id →", "24 h TTL"], "1:N"),
        ("reels", ["owner_id →", "reel_likes, reel_views"], "1:N"),
        ("follows / friendships", ["follower_id, followee_id", "requester, addressee"], "M:N"),
        ("groups / group_members", ["owner_id →", "role in group"], "M:N"),
        ("pages / page_followers", ["owner_id →"], "M:N"),
        ("notifications", ["recipient_id, actor_id", "post_id, comment_id"], "1:N"),
        ("blocks / reports", ["blocker, blocked", "reporter, reviewed_by"], "1:N"),
    ], height=640, rx=352, ry=248)

F["er_msg"] = er_free(
    {
        "profiles": (36, 200, 150, ["id uuid PK", "username", "role"], "core"),
        "conversations": (250, 30, 170, ["id uuid PK", "is_group", "direct_key unique",
                                         "created_by →", "last_message_at"], "green"),
        "conversation_participants": (250, 210, 190, ["conversation_id →", "user_id →",
                                                      "last_read_at"], "blue"),
        "messages": (250, 350, 170, ["conversation_id →", "sender_id →", "content",
                                     "image_path", "voice / attachment"], "blue"),
        "live_locations": (520, 360, 170, ["conversation_id →", "message_id →",
                                           "user_id →", "expires_at"], "blue"),
        "ptt_channels": (720, 24, 160, ["owner_id →", "ptt_channel_members",
                                        "ptt_messages"], "amber"),
        "cohost_rooms": (720, 130, 160, ["host_id →", "cohost_guests", "livekit room"], "amber"),
        "device_tokens": (520, 180, 160, ["user_id →", "fcm token", "platform"], "grey"),
        "push_subscriptions": (520, 260, 160, ["user_id →", "web-push endpoint"], "grey"),
    },
    [("profiles", "conversations", "created_by"),
     ("profiles", "conversation_participants", "member"),
     ("conversations", "conversation_participants", "1:N"),
     ("conversations", "messages", "1:N"),
     ("profiles", "messages", "sender"),
     ("messages", "live_locations", "attached"),
     ("profiles", "ptt_channels", "owner"),
     ("profiles", "cohost_rooms", "host"),
     ("profiles", "device_tokens", ""),
     ("profiles", "push_subscriptions", "")],
    height=470)

F["er_live"] = er_free(
    {
        "profiles": (36, 210, 150, ["id uuid PK", "role"], "core"),
        "live_streams": (250, 170, 190, ["id uuid PK", "host_id →", "status", "provider",
                                         "ivs_channel / livekit_room", "recording_path",
                                         "viewer_count"], "core"),
        "live_stream_keys": (520, 40, 175, ["stream_id →", "host-only RLS",
                                            "stream key never read by viewers"], "amber"),
        "live_chat_messages": (520, 130, 175, ["stream_id →", "user_id →"], "blue"),
        "live_reactions": (520, 205, 175, ["stream_id →", "user_id →"], "blue"),
        "live_stream_presence": (520, 280, 175, ["stream_id →", "viewer heartbeat"], "blue"),
        "live_products": (520, 355, 175, ["stream_id →", "product_id →"], "green"),
        "live_gifts": (742, 130, 140, ["catalogue", "price in G-Pay"], "amber"),
        "live_gift_events": (742, 215, 140, ["gift_id →", "sender_id →", "host_id →"], "amber"),
        "shop_products": (742, 340, 140, ["seller_id →"], "green"),
    },
    [("profiles", "live_streams", "host"),
     ("live_streams", "live_stream_keys", "1:1"),
     ("live_streams", "live_chat_messages", "1:N"),
     ("live_streams", "live_reactions", "1:N"),
     ("live_streams", "live_stream_presence", "1:N"),
     ("live_streams", "live_products", "1:N"),
     ("live_gifts", "live_gift_events", "1:N"),
     ("live_products", "shop_products", "")],
    height=450)

F["er_commerce"] = er_free(
    {
        "profiles": (30, 210, 140, ["id uuid PK"], "core"),
        "shop_products": (210, 60, 180, ["seller_id →", "kind: dropship|affiliate",
                                         "price, currency", "images[], specs, variants",
                                         "commission_rate"], "green"),
        "shop_orders": (210, 220, 180, ["buyer_id →", "seller_id →", "product_id →",
                                        "status, ship_*"], "green"),
        "affiliate_clicks": (210, 350, 180, ["product_id →", "user_id →"], "grey"),
        "gpay_accounts": (450, 220, 170, ["user_id → unique", "balance", "status, NRC"], "core"),
        "gpay_transactions": (450, 340, 170, ["from_account →", "to_account →",
                                              "kind, amount"], "amber"),
        "stores": (680, 40, 190, ["owner_id →", "store_members"], "blue"),
        "pos_products": (680, 120, 190, ["store_id →", "category_id →", "inventory"], "blue"),
        "sales": (680, 210, 190, ["store_id →", "shift_id →", "cashier_id →",
                                  "sale_items, sale_payments"], "blue"),
        "membership_plans": (680, 330, 190, ["subscriptions →", "payments → invoices"], "amber"),
    },
    [("profiles", "shop_products", "seller"),
     ("profiles", "shop_orders", "buyer"),
     ("shop_products", "shop_orders", "1:N"),
     ("shop_products", "affiliate_clicks", "1:N"),
     ("profiles", "gpay_accounts", "1:1"),
     ("gpay_accounts", "gpay_transactions", "1:N"),
     ("shop_orders", "gpay_accounts", "pay"),
     ("stores", "pos_products", "1:N"),
     ("stores", "sales", "1:N"),
     ("sales", "gpay_accounts", "settle"),
     ("profiles", "membership_plans", "subscribe")],
    height=460)

F["er_ride"] = er_free(
    {
        "profiles": (36, 190, 150, ["id uuid PK", "rider or driver"], "core"),
        "ride_driver_profiles": (250, 40, 190, ["user_id →", "vehicle_type →",
                                                "3 documents", "status, approved_by →"], "blue"),
        "ride_vehicle_types": (500, 40, 170, ["code, label", "base fare, per km",
                                              "surge"], "grey"),
        "rides": (250, 175, 190, ["rider_id →", "driver_id →", "status (state machine)",
                                  "pickup / destination", "fare, payment_method",
                                  "share_token"], "core"),
        "ride_offers": (500, 160, 170, ["ride_id →", "driver_id →", "expires_at"], "amber"),
        "ride_driver_locations": (500, 260, 170, ["driver_id →", "lat/lng, online",
                                                  "heartbeat 30 s"], "amber"),
        "ride_ledger": (500, 360, 170, ["ride_id →", "driver_id →", "commission owed"], "amber"),
        "ride_driver_balances": (720, 360, 160, ["driver_id →", "settled from G-Pay"], "green"),
        "sos_alerts": (250, 360, 190, ["user_id →", "trip attached:", "plate, driver, dest"], "green"),
        "ride_settings": (720, 40, 160, ["platform_gpay_account →", "commission %"], "grey"),
    },
    [("profiles", "ride_driver_profiles", "1:1"),
     ("ride_driver_profiles", "ride_vehicle_types", ""),
     ("profiles", "rides", "rider"),
     ("rides", "ride_offers", "1:N"),
     ("profiles", "ride_driver_locations", "driver"),
     ("rides", "ride_ledger", "1:N"),
     ("ride_ledger", "ride_driver_balances", ""),
     ("rides", "sos_alerts", "in-trip"),
     ("ride_vehicle_types", "ride_settings", "")],
    height=470)

F["er_learn"] = er_free(
    {
        "profiles": (36, 190, 150, ["id uuid PK", "role"], "core"),
        "lesson_progress": (250, 60, 180, ["user_id →", "track, lesson", "score, completed_at"], "blue"),
        "member_projects": (250, 160, 180, ["user_id →", "playground autosave"], "blue"),
        "certificates": (250, 250, 180, ["user_id →", "track, issued_at", "verify code"], "blue"),
        "lesson_comments": (250, 340, 180, ["author_id →", "lesson key", "photo"], "blue"),
        "typing_scores": (490, 60, 175, ["user_id →", "wpm, accuracy"], "grey"),
        "teacher_applications": (490, 150, 175, ["user_id →", "status"], "amber"),
        "live_streams": (490, 240, 175, ["host_id →", "classroom mode"], "amber"),
        "games / game_catalog": (490, 330, 175, ["author_id →", "game_reactions",
                                                 "game_comments"], "green"),
        "strains / minerals": (720, 130, 160, ["public read", "FTS + trigram"], "grey"),
        "mine_sites": (720, 240, 160, ["created_by →", "mine_site_reports"], "grey"),
        "search_queries": (720, 330, 160, ["user_id →", "keyword, results"], "grey"),
    },
    [("profiles", "lesson_progress", ""),
     ("profiles", "member_projects", ""),
     ("profiles", "certificates", ""),
     ("profiles", "lesson_comments", ""),
     ("profiles", "typing_scores", ""),
     ("profiles", "teacher_applications", ""),
     ("teacher_applications", "live_streams", "teach"),
     ("profiles", "games / game_catalog", ""),
     ("lesson_comments", "strains / minerals", ""),
     ("mine_sites", "strains / minerals", ""),
     ("profiles", "search_queries", "")],
    height=460)

F["er_iot"] = er_free(
    {
        "profiles": (36, 190, 150, ["id uuid PK", "owner of everything"], "core"),
        "devices": (250, 60, 180, ["owner_id →", "type, mqtt creds", "last_seen"], "blue"),
        "sensor_readings": (490, 40, 175, ["device_id →", "metric, value, ts"], "blue"),
        "automation_rules": (490, 120, 175, ["trigger_device_id →", "action_device_id →",
                                             "cooldown"], "blue"),
        "alerts": (720, 80, 160, ["device_id →", "rule_id →", "owner_id →"], "amber"),
        "device_commands": (490, 210, 175, ["device_id →", "issued_by →"], "blue"),
        "scenes / scene_schedules": (250, 160, 180, ["owner_id →", "smart home"], "blue"),
        "user_cameras": (250, 250, 180, ["owner_id →", "RTSP / KVS", "camera_group_shares"], "green"),
        "camera_clips": (490, 290, 175, ["camera_id →", "owner_id →"], "green"),
        "camera_alerts": (720, 290, 160, ["camera_id →", "clip_id →"], "green"),
        "wifi_scans / networks": (250, 350, 180, ["user_id →", "BSSID, RSSI, band",
                                                  "wifi_watchlist"], "grey"),
        "drone_detections": (490, 380, 175, ["RSSI history", "drone_race_scores"], "grey"),
    },
    [("profiles", "devices", "owner"),
     ("devices", "sensor_readings", "1:N"),
     ("devices", "automation_rules", ""),
     ("automation_rules", "alerts", "fires"),
     ("devices", "device_commands", ""),
     ("profiles", "scenes / scene_schedules", ""),
     ("profiles", "user_cameras", ""),
     ("user_cameras", "camera_clips", ""),
     ("camera_clips", "camera_alerts", ""),
     ("profiles", "wifi_scans / networks", ""),
     ("wifi_scans / networks", "drone_detections", "")],
    height=470)

F["er_platform"] = er_free(
    {
        "profiles": (36, 180, 150, ["id uuid PK", "role user_role"], "core"),
        "api_keys": (250, 40, 180, ["owner_id →", "hashed key", "scopes[], rate limit"], "amber"),
        "api_logs": (490, 40, 170, ["api_key_id →", "path, status, ms"], "amber"),
        "webhooks": (250, 130, 180, ["owner_id →", "HMAC secret", "event filter"], "amber"),
        "webhook_deliveries": (490, 130, 170, ["webhook_id →", "attempts, status"], "amber"),
        "feature_flags": (250, 225, 180, ["key, enabled", "rollout"], "grey"),
        "site_settings": (490, 225, 170, ["theme, toggles"], "grey"),
        "audit_logs": (250, 310, 180, ["actor_id →", "action, target"], "blue"),
        "reports": (490, 310, 170, ["reporter_id →", "post/comment", "reviewed_by →"], "blue"),
        "boosts": (720, 130, 160, ["owner_id →", "escrow, bid", "boost_impressions"], "green"),
        "consents / deletion_requests": (720, 250, 160, ["user_id →", "GDPR-style"], "grey"),
        "search_queries": (720, 350, 160, ["keyword analytics"], "grey"),
    },
    [("profiles", "api_keys", "owner"),
     ("api_keys", "api_logs", "1:N"),
     ("profiles", "webhooks", "owner"),
     ("webhooks", "webhook_deliveries", "1:N"),
     ("profiles", "audit_logs", "actor"),
     ("profiles", "reports", "reporter"),
     ("profiles", "boosts", "advertiser"),
     ("profiles", "feature_flags", ""),
     ("feature_flags", "site_settings", ""),
     ("boosts", "consents / deletion_requests", ""),
     ("consents / deletion_requests", "search_queries", "")],
    height=430)

# ============================================================== FIG 15 =======
# Security model
b = []
b.append(zone(20, 20, 424, 200, "identity", "#c7d2fe"))
b.append(node(38, 54, 180, 44, "Cognito user pool", "blue", sub="ap-southeast-1_krSbdHFs9"))
b.append(node(38, 108, 180, 44, "custom:profile_id", "blue", sub="authoritative account link"))
b.append(node(38, 162, 180, 44, "gw_at / gw_it / gw_rt", "blue", sub="httpOnly cookies"))
b.append(node(244, 54, 182, 152, "never back-fill|on a failed lookup", "amber",
              sub="undefined = failure, null = absent"))

b.append(zone(456, 20, 424, 200, "authorisation", "#bcd9c9"))
b.append(node(474, 54, 180, 44, "ES256 data token", "soft", sub="APP_JWT_PRIVATE_KEY"))
b.append(node(474, 108, 180, 44, "row level security", "soft", sub="on all 159 tables"))
b.append(node(474, 162, 180, 44, "6 roles", "soft", sub="user…super_admin"))
b.append(node(680, 54, 182, 152, "requireRole() +|requireMembership()", "soft",
              sub="server-side gate before any privileged call"))

b.append(zone(20, 244, 860, 132, "hardening", "#f0d3a0"))
b.append(node(38, 282, 196, 76, "secrets stay off the image", "amber",
              sub="/etc/gwave-web.env at runtime; NEXT_PUBLIC_* are public by design"))
b.append(node(250, 282, 196, 76, "rate limiting", "amber",
              sub="300 req/min/IP in middleware + per-key API limits"))
b.append(node(462, 282, 196, 76, "money RPCs locked", "amber",
              sub="SECURITY DEFINER, EXECUTE to service_role only"))
b.append(node(674, 282, 188, 76, "private media", "amber",
              sub="chat + KYC in private buckets, short-lived signed GETs"))
F["security"] = svg(900, 392, b)
