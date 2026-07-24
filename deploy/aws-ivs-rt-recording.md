# Browser Go Live → replay (IVS Real-Time composite recording)

Browser broadcasts (phone/desktop camera on gwave.cc) run on **IVS Real-Time
stages**. A server-side *composition* records the mixed view to S3 using the
**EC2 instance role** — there is **no static IAM access key** involved. The
code (`startIvsComposition` on go-live, `stopIvsComposition` on end, gated by
the host's Record toggle) is already wired; it activates the moment these two
config ARNs are present in `/etc/gwave-web.env`.

Run everything below **on the EC2 box** (the instance role has IVS admin).

## 1. Reuse the existing recordings bucket

The app already serves replays from `IVS_RECORDING_BUCKET` through the
`/recordings` proxy. Point the RT storage config at the **same bucket** so
playback works with zero extra wiring:

```bash
BUCKET=$(sudo grep -E '^IVS_RECORDING_BUCKET=' /etc/gwave-web.env | cut -d= -f2-)
REGION=$(sudo grep -E '^IVS_REGION=' /etc/gwave-web.env | cut -d= -f2-)
REGION=${REGION:-ap-northeast-1}
echo "bucket=$BUCKET region=$REGION"
```

## 2. Create the storage + encoder configurations

```bash
STORAGE_ARN=$(aws ivs-realtime create-storage-configuration --region "$REGION" \
  --name gwave-rt-recording \
  --s3 "bucketName=$BUCKET" \
  --query 'storageConfiguration.arn' --output text)
echo "IVS_RT_STORAGE_CONFIG_ARN=$STORAGE_ARN"

# 720p portrait (9:16) fits phone lives; use 1280x720 for landscape.
ENCODER_ARN=$(aws ivs-realtime create-encoder-configuration --region "$REGION" \
  --name gwave-rt-portrait-720 \
  --video 'width=720,height=1280,framerate=30,bitrate=2500000' \
  --query 'encoderConfiguration.arn' --output text)
echo "IVS_RT_ENCODER_CONFIG_ARN=$ENCODER_ARN"
```

`create-storage-configuration` also **auto-attaches an S3 bucket policy** that
lets IVS write recordings — no manual bucket policy edit needed.

## 3. Add the two ARNs to runtime env + redeploy

```bash
sudo tee -a /etc/gwave-web.env >/dev/null <<EOF
IVS_RT_STORAGE_CONFIG_ARN=$STORAGE_ARN
IVS_RT_ENCODER_CONFIG_ARN=$ENCODER_ARN
EOF
sudo gwave-redeploy
```

## 4. Instance-role permissions (only if StartComposition is denied)

The instance role already runs the other IVS calls. If go-live logs show an
AccessDenied on composition, add this statement to its policy:

```json
{
  "Effect": "Allow",
  "Action": [
    "ivs:StartComposition",
    "ivs:StopComposition",
    "ivs:GetComposition",
    "ivs:ListCompositions"
  ],
  "Resource": "*"
}
```

## Verify

Go Live from a browser with **Record ON** → end it → open the stream page. The
replay plays through `/recordings/...` just like app (IVS channel) replays. If
`record_enabled` is false the composition never starts, so no replay is saved.
