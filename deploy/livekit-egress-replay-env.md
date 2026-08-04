# LiveKit replay — server env setup (one time)

Metaverse/browser Go Live replays need LiveKit Egress to upload MP4s to
S3 with **static IAM credentials** (egress cannot use the EC2 instance
role). The app code is already complete — `goLive()` starts the
recording, the end route stops it, and the recordings sweep publishes
the replay. Only these envs are missing.

## 1. Create the IAM key (run in AWS CloudShell — needs admin creds)

Replace `BUCKET` with the recordings bucket (the existing IVS
recordings bucket is fine — recordings land under their own
`live-recordings/` prefix).

```bash
BUCKET=<your-recordings-bucket>

aws iam create-user --user-name gwave-livekit-egress
aws iam put-user-policy --user-name gwave-livekit-egress \
  --policy-name gwave-egress-s3-put \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:PutObject\", \"s3:AbortMultipartUpload\", \"s3:ListMultipartUploadParts\"],
      \"Resource\": \"arn:aws:s3:::${BUCKET}/live-recordings/*\"
    }]
  }"
aws iam create-access-key --user-name gwave-livekit-egress
```

Note the `AccessKeyId` and `SecretAccessKey` from the last command.

## 2. Add the envs on EC2

```bash
sudo tee -a /etc/gwave-web.env >/dev/null <<'ENV'
LIVEKIT_EGRESS_S3_BUCKET=<BUCKET>
LIVEKIT_EGRESS_S3_ACCESS_KEY=<AccessKeyId>
LIVEKIT_EGRESS_S3_SECRET=<SecretAccessKey>
NEXT_PUBLIC_LIVEKIT_EGRESS_BASE=<public CloudFront/S3 base URL of BUCKET>
ENV
sudo gwave-redeploy
```

`NEXT_PUBLIC_LIVEKIT_EGRESS_BASE` is read **server-side at runtime**
(replay URL is built in a server component), so no image rebuild is
needed — `gwave-redeploy` is enough.

## 3. Verify

1. Metaverse → Go Live → stop after ~30s.
2. Wait ~1 minute (egress upload), open the live's page from the feed —
   the replay player should appear instead of "This broadcast has
   ended."
3. If not, check the row in `live_streams` (`recording_egress_id`,
   `recording_path`) and the app logs for `[live/goLive] recording`.

Security notes: the key can only `PutObject` under one prefix of one
bucket; never commit it, never put it in `NEXT_PUBLIC_*` build args.
