#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# coturn TURN/STUN server for gwave.ai messenger audio/video calls.
#
# WebRTC signaling already runs over our self-hosted Realtime; this relay lets calls
# connect through strict/symmetric NATs and mobile carriers.
#
# Run on a fresh Ubuntu 22.04 EC2 (t3.small is plenty), as root (sudo -i).
# Attach an Elastic IP. Open in the security group:
#   UDP+TCP 3478 (STUN/TURN), UDP+TCP 5349 (TLS), UDP 49152-65535 (relay).
# ---------------------------------------------------------------------------
set -euo pipefail

PUBLIC_IP="${1:?usage: coturn-setup.sh <ELASTIC_IP> <TURN_USER> <TURN_PASS> [realm]}"
TURN_USER="${2:?usage: coturn-setup.sh <ELASTIC_IP> <TURN_USER> <TURN_PASS> [realm]}"
TURN_PASS="${3:?usage: coturn-setup.sh <ELASTIC_IP> <TURN_USER> <TURN_PASS> [realm]}"
REALM="${4:-gwave.ai}"

echo ">>> Installing coturn (realm=${REALM}, public IP=${PUBLIC_IP})"
apt-get update -y
apt-get install -y coturn

sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn || \
  echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn

cat >/etc/turnserver.conf <<CONF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=${PUBLIC_IP}
min-port=49152
max-port=65535
fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_PASS}
realm=${REALM}
no-cli
# Security hardening: don't relay to private ranges or loopback.
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
CONF

systemctl enable --now coturn
systemctl restart coturn

echo ""
echo ">>> coturn is running. Set these in the app environment:"
echo "    NEXT_PUBLIC_TURN_URL=turn:${PUBLIC_IP}:3478"
echo "    NEXT_PUBLIC_TURN_USERNAME=${TURN_USER}"
echo "    NEXT_PUBLIC_TURN_CREDENTIAL=${TURN_PASS}"
echo ""
echo ">>> Test with: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
