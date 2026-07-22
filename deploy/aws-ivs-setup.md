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

## Phase 3 — Chime SDK (messenger calls)

Call media moves from the peer-to-peer WebRTC mesh to Amazon Chime meetings
(placed in **ap-southeast-1** — Chime supports it). The ring/accept signaling
over our self-hosted Realtime is unchanged; only the media transport swaps, behind
`NEXT_PUBLIC_CALL_PROVIDER` (default `mesh`).

### 1. IAM: extend the instance-role policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "chime:CreateMeeting",
        "chime:CreateAttendee",
        "chime:DeleteMeeting"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. App environment

```
NEXT_PUBLIC_CALL_PROVIDER=mesh   # flip to chime after the client wiring lands
CHIME_CONTROL_REGION=ap-southeast-1
CHIME_MEDIA_REGION=ap-southeast-1
```

Server foundation (meeting/attendee actions) ships first; the use-call client
integration (joining the meeting with amazon-chime-sdk-js on accept) lands in
its own PR, after which the flag can flip.

## Phase 4 — Cutover checklist

Run through in order; each step is independently reversible.

1. **Migrations** (idempotent, run all three on the prod DB): Phase 1 `ivs_*`
   channel columns, Phase 2 `ivs_stage_arn`/`ivs_composition_arn`.
2. **IAM**: attach the Phase 1 + 2 (+ 3) policies to the app EC2 instance role.
3. **IVS console (Tokyo)**: recordings bucket, Low-Latency recording
   configuration, Real-Time storage + encoder configurations, CloudFront over
   the bucket.
4. **Env**: `IVS_REGION`, `IVS_RECORDING_CONFIG_ARN`, `IVS_RT_STORAGE_CONFIG_ARN`,
   `IVS_RT_ENCODER_CONFIG_ARN`, `NEXT_PUBLIC_IVS_RECORDING_BASE`.
5. **Flip Live**: `NEXT_PUBLIC_LIVE_PROVIDER=ivs`, restart the app container.
   Verify: camera broadcast (phone), OBS broadcast, both replays. Roll back by
   flipping to `livekit`.
6. **Flip calls** (after the Chime client PR): `NEXT_PUBLIC_CALL_PROVIDER=chime`.
   Verify 1:1 audio + video call. Roll back to `mesh`.
7. **Decommission** (only after a comfortable soak): LiveKit EC2 box
   (52.77.195.25), Mux account, Agora project; then remove their code paths.
