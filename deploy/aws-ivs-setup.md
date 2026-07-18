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

## Phase 2 — IVS Real-Time (phone Live) · Phase 3 — Chime (calls)

Follow-up phases; this doc gains their sections when the code lands.
