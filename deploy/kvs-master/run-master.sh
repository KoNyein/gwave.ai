#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start the KVS WebRTC master: pull the camera's RTSP feed with GStreamer and
# stream it into your Kinesis signaling channel. Keep this running (systemd /
# tmux / screen) for the camera to stay live on the website.
#
#   cp .env.example .env    # fill it in first
#   bash run-master.sh
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")"
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

: "${KVS_CHANNEL:?Set KVS_CHANNEL in .env (your signaling channel name)}"
: "${RTSP_URL:?Set RTSP_URL in .env (rtsp://USER:PASS@IP:554/stream1)}"
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID in .env}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY in .env}"

# The C SDK reads AWS creds + region from these standard env vars.
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${KVS_REGION:-ap-southeast-1}}"
export AWS_KVS_LOG_LEVEL="${AWS_KVS_LOG_LEVEL:-2}"

SDK_DIR="${SDK_DIR:-$HOME/amazon-kinesis-video-streams-webrtc-sdk-c}"
BIN="$SDK_DIR/build/samples/kvsWebrtcClientMasterGstSample"
if [ ! -x "$BIN" ]; then
  echo "!! Master binary not found at $BIN — run: bash install.sh" >&2
  exit 1
fi

echo ">>> Streaming '$RTSP_URL' -> KVS channel '$KVS_CHANNEL' ($AWS_DEFAULT_REGION)"
echo ">>> Ctrl-C to stop."

# Arg form for recent SDKs:
#   <channel> <audio-video|video-only> <testsrc|devicesrc|rtspsrc> <rtsp-url>
# If your SDK version rejects these args, check samples/README (arg order has
# changed across releases) — but channel + rtspsrc + URL is the shape you want.
exec "$BIN" "$KVS_CHANNEL" video-only rtspsrc "$RTSP_URL"
