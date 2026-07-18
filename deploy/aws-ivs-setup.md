# AWS Live stack — setup (Amazon IVS + Chime)

The full-AWS Live architecture, rolled out in phases behind
`NEXT_PUBLIC_LIVE_PROVIDER`:

| Feature | AWS service | Phase |
|---|---|---|
| OBS / game streams (RTMP, Twitch-style) | **IVS Low-Latency** | 1 (this doc) |
| Phone-browser Live (FB/TikTok-style) | **IVS Real-Time** | 2 |
| Messenger video/audio calls | **Chime SDK** | 3 |
| Recording / replay | IVS auto-record → **S3 + CloudFront** | 1–2 |

**Region:** IVS isn't offered in ap-southeast-1, so the control plane and the
recordings bucket live in **ap-northeast-1 (Tokyo)**. Video ingest/playback ride
AWS's global edge — viewer latency in Myanmar is unaffected.

## Phase 1 — IVS Low-Latency (OBS/game streams)

### 1. IAM: allow the app to manage IVS channels

The app signs IVS API calls with the **EC2 instance role** (the same role the
app server already runs with — no static keys). Attach this policy to that role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:CreateChannel",
        "ivs:DeleteChannel",
        "ivs:GetStream",
        "ivs:StopStream",
        "ivs:TagResource"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. (Optional but recommended) S3 auto-record

In the AWS console, **region Tokyo (ap-northeast-1)**:

1. Create an S3 bucket for recordings (e.g. `gwave-live-recordings`, Tokyo).
2. IVS console → **Recording configurations** → create one pointing at that
   bucket. Copy its **ARN**.
3. Serve the bucket via CloudFront if replays should play back publicly.

### 3. App environment

```
IVS_REGION=ap-northeast-1
IVS_RECORDING_CONFIG_ARN=<arn from step 2, or leave blank for no recording>
NEXT_PUBLIC_LIVE_PROVIDER=ivs
```

### 4. Database migration (idempotent)

```sql
alter table public.live_streams
  add column if not exists ivs_channel_arn text,
  add column if not exists ivs_ingest_url text,
  add column if not exists ivs_playback_url text;
```

### 5. How it works / verify

1. Create a broadcast on `/live/new` → the app provisions an IVS channel; the
   host sees the **RTMPS URL + stream key** in the host panel.
2. Paste both into OBS (Settings → Stream → Custom) and Start Streaming.
3. Open the watch page — the app checks the channel and flips the stream LIVE;
   viewers watch the HLS playback (global edge, ~3 s latency).
4. **End stream** stops the IVS broadcast; with a recording configuration
   attached, IVS finishes writing the recording to S3 automatically.

Notes:
- The stream key is stored host-only (`live_stream_keys`, RLS) exactly like the
  old Mux key.
- Live-status flips on page view (GetStream) for now; an EventBridge → webhook
  wiring can replace that later for instant transitions.

## Phase 2 — IVS Real-Time (phone-browser Live)

FB/TikTok-style: the host broadcasts from the phone/browser camera over WebRTC
(an IVS *stage*), viewers subscribe through the global edge, and a server-side
*composition* records the mixed view to S3.

### 1. IAM: extend the instance-role policy

Add the realtime actions to the Phase 1 policy (or a second inline policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:CreateStage",
        "ivs:DeleteStage",
        "ivs:CreateParticipantToken",
        "ivs:StartComposition",
        "ivs:StopComposition",
        "ivs:GetComposition"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Recording (optional): storage + encoder configurations

IVS console (Tokyo) → Real-Time streaming:

1. **Storage configuration** → point at the recordings bucket → copy ARN.
2. **Encoder configuration** → 720×1280 (portrait) or 1280×720 → copy ARN.
3. Serve the bucket via CloudFront for public replay playback.

### 3. App environment

```
IVS_RT_STORAGE_CONFIG_ARN=<storage config arn>
IVS_RT_ENCODER_CONFIG_ARN=<encoder config arn>
NEXT_PUBLIC_IVS_RECORDING_BASE=https://<cloudfront-over-recordings-bucket>
```

### 4. Database migration (idempotent)

```sql
alter table public.live_streams
  add column if not exists ivs_stage_arn text,
  add column if not exists ivs_composition_arn text;
```

### 5. Verify

With `NEXT_PUBLIC_LIVE_PROVIDER=ivs`, `/live/new` shows a mode picker:
**📱 ဖုန်းကင်မရာ** creates a stage (camera broadcast in the browser);
**🎮 OBS / Game** creates a Low-Latency channel (Phase 1). Start a camera
broadcast, end it, and the replay (HLS) appears once the composition finishes.

## Phase 3 — Chime (messenger calls)

Follow-up phase; this doc gains its section when the code lands.
