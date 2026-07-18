# Live auto-save (recording) — setup

Browser (LiveKit) broadcasts are recorded to S3 and played back as a replay on
the ended watch page. The app code ships behind an env gate: with nothing
configured, Live works exactly as before (no recording). Two things turn it on.

## Step 1 — Database migration

Adds `recording_path` and `recording_egress_id` to `live_streams`. Idempotent.

Run it once against the production database — either in the Supabase SQL Editor,
or via psql:

```sql
alter table public.live_streams
  add column if not exists recording_path text,
  add column if not exists recording_egress_id text;
```

(Same as `supabase/migrations/20260719120000_live_recording.sql`.)

## Step 2 — LiveKit Egress worker + S3

### 2a. A recordings bucket + an IAM user for the egress worker

The egress worker uploads with **static** credentials (it can't use the app's
EC2 instance role). Create (or reuse) an S3 bucket, then an IAM user whose only
permission is to write into it:

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
(CloudFront distribution, or S3 static-website/`public-read` on that prefix) —
that URL is `NEXT_PUBLIC_LIVEKIT_EGRESS_BASE`, and replays load from
`<base>/live-recordings/<file>.mp4`.

### 2b. Run the egress worker on the SFU box

On the same host as the LiveKit server, as root:

```bash
sudo API_KEY=APIgwave deploy/livekit-egress-setup.sh <LIVEKIT_API_SECRET>
```

This installs Redis + Docker, points the LiveKit server at Redis (egress
requires it), renders `/etc/livekit/egress.yaml`, and starts the
`livekit/egress` container. Verify with `docker logs -f livekit-egress`.

The finished-recording signal reuses the existing
`https://gwave.cc/api/live/livekit-webhook` webhook (it already handles the
`egress_ended` event), so no extra webhook wiring is needed.

### 2c. App environment

Set these on the app (ECS task / Secrets Manager) and redeploy:

```
LIVEKIT_EGRESS_S3_BUCKET=YOUR_RECORDINGS_BUCKET
LIVEKIT_EGRESS_S3_ACCESS_KEY=<IAM key from 2a>
LIVEKIT_EGRESS_S3_SECRET=<its secret>
LIVEKIT_EGRESS_S3_REGION=ap-southeast-1
LIVEKIT_EGRESS_S3_PREFIX=live-recordings
NEXT_PUBLIC_LIVEKIT_EGRESS_BASE=https://<cloudfront-or-s3-website-for-that-bucket>
```

Keep `LIVEKIT_EGRESS_S3_SECRET` server-only — never expose it to the client.

## Verifying

Start a browser Live, talk for a few seconds, End stream. Within a minute the
row on `/live` flips its badge from **Ended** to **Replay**, and opening it plays
the recording. If it stays **Ended**: `docker logs livekit-egress` on the SFU,
and confirm the app has all six env vars and was redeployed.
