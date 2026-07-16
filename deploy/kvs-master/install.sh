#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Install the Amazon KVS WebRTC C SDK + GStreamer on a local box (Ubuntu /
# Debian / Raspberry Pi OS) that sits next to your CCTV. This box is the
# "master": it pulls the camera's RTSP feed with GStreamer and pushes it into a
# Kinesis Video Streams signaling channel over WebRTC, so gwave.cc can show it
# with sub-second latency.
#
# Run once:   bash install.sh
# Then:       cp .env.example .env   (fill it in)  &&  bash run-master.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SDK_DIR="${SDK_DIR:-$HOME/amazon-kinesis-video-streams-webrtc-sdk-c}"

echo ">>> [1/3] Installing build tools + GStreamer ..."
sudo apt-get update
sudo apt-get install -y \
  git cmake m4 build-essential pkg-config \
  libssl-dev libcurl4-openssl-dev liblog4cplus-dev \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
  gstreamer1.0-tools gstreamer1.0-libav

echo ">>> [2/3] Fetching the KVS WebRTC C SDK ..."
if [ ! -d "$SDK_DIR/.git" ]; then
  git clone --depth 1 \
    https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-c.git \
    "$SDK_DIR"
else
  git -C "$SDK_DIR" pull --ff-only || true
fi

echo ">>> [3/3] Building (with GStreamer samples) — this can take a while ..."
mkdir -p "$SDK_DIR/build"
cd "$SDK_DIR/build"
cmake .. -DBUILD_GSTREAMER_SAMPLES=ON
make -j"$(nproc)"

echo ""
echo ">>> Done. The master binary is:"
echo "    $SDK_DIR/build/samples/kvsWebrtcClientMasterGstSample"
echo ">>> Next: cp .env.example .env  (fill it in), then: bash run-master.sh"
