# Agora Live provider — setup (Phase 0)

Agora is the managed Live provider: WebRTC browser broadcasting with low Asia
latency, and Cloud Recording that saves every broadcast straight to S3 — no
recording server for us to run. It ships behind a feature flag beside LiveKit,
so nothing changes until `NEXT_PUBLIC_LIVE_PROVIDER=agora` is set.

There are no servers to maintain here — this is all Agora console + AWS IAM, done
once.

## 1. Agora project

1. Create an account at <https://console.agora.io> and a new **project**.
2. Enable **App Certificate** (Security → "Secured mode: APP ID + Token").
3. Copy the **App ID** and **App Certificate**.
4. Enable **Cloud Recording** for the project (Products → Cloud Recording).
5. Under **RESTful API** (Developer Toolkit → RESTful API), create a **Customer
   ID** + **Customer Secret** — these authorize the recording REST calls.

## 2. A recordings bucket + an IAM user for Agora

Agora's recorder uploads with **static** credentials (it can't use our EC2
instance role). Reuse the media bucket or make a new one in **ap-southeast-1**,
then an IAM user that can only write the recordings prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_RECORDINGS_BUCKET/live-recordings/*"
    }
  ]
}
```

Note the access key + secret. Serve the bucket/prefix over a public base URL
(CloudFront, or the same media CDN if recordings go to the media bucket) — that's
`NEXT_PUBLIC_AGORA_RECORDING_BASE`; replays load from `<base>/<recording key>`.
Left unset, playback falls back to the media CDN (`NEXT_PUBLIC_S3_CDN`).

Agora's region code for **ap-southeast-1 (Singapore) is `8`** — the default.

## 3. Database migration

Apply once against the production DB (idempotent). Same as
`supabase/migrations/20260719140000_live_agora.sql`:

```sql
alter table public.live_streams
  add column if not exists agora_channel text,
  add column if not exists agora_resource_id text,
  add column if not exists agora_recording_sid text;
```

## 4. App environment

Set on the app (ECS task / container env) and redeploy — but **keep the flag on
`livekit` until you've smoke-tested Agora** (see below):

```
NEXT_PUBLIC_AGORA_APP_ID=<App ID>
AGORA_APP_CERTIFICATE=<App Certificate>
AGORA_CUSTOMER_ID=<RESTful Customer ID>
AGORA_CUSTOMER_SECRET=<RESTful Customer Secret>
AGORA_RECORDING_S3_BUCKET=<recordings bucket>
AGORA_RECORDING_S3_ACCESS_KEY=<IAM key from step 2>
AGORA_RECORDING_S3_SECRET=<its secret>
AGORA_RECORDING_S3_REGION=8
AGORA_RECORDING_S3_PREFIX=live-recordings
NEXT_PUBLIC_AGORA_RECORDING_BASE=https://<cloudfront-or-s3-for-recordings>
# Leave this on livekit until Agora is verified, then flip to agora:
NEXT_PUBLIC_LIVE_PROVIDER=livekit
```

Keep `AGORA_APP_CERTIFICATE`, `AGORA_CUSTOMER_SECRET`, and the S3 secret
server-only — never expose them to the client.

## 5. Cutover (safe)

The provider is per-stream: existing LiveKit streams keep working. Once the env
is in place, flip `NEXT_PUBLIC_LIVE_PROVIDER=agora` and redeploy — **new**
broadcasts become Agora; in-flight/old ones stay on their original provider. If
anything misbehaves, flip back to `livekit` and redeploy; no data is lost.

Verify: start a broadcast, talk a few seconds, end it. Within a minute the
`/live` row badges **Replay** and the recording plays back.
