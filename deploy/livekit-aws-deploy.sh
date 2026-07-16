#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command AWS deploy of the LiveKit SFU for gwave.ai.
#
# Runs on YOUR machine with the AWS CLI configured (aws configure). It launches
# deploy/livekit-cloudformation.yaml: one EC2 + Elastic IP + security group,
# with LiveKit + Caddy(TLS) installed on first boot. Prints the values to set
# in the app (NEXT_PUBLIC_LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).
#
# Usage:
#   aws configure                       # once, with an IAM user that can make EC2/CFN
#   bash deploy/livekit-aws-deploy.sh live.gwave.cc you@email.com my-ec2-keypair
#
# Optional env: REGION (default from your AWS config), INSTANCE_TYPE (t3.large),
#               SSH_CIDR (0.0.0.0/0 — set to YOUR.IP/32 to lock SSH down),
#               API_KEY (APIgwave), API_SECRET (auto-generated if unset).
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="${1:?usage: livekit-aws-deploy.sh <domain> <email> <ec2-keypair-name>}"
EMAIL="${2:?usage: livekit-aws-deploy.sh <domain> <email> <ec2-keypair-name>}"
KEYPAIR="${3:?usage: livekit-aws-deploy.sh <domain> <email> <ec2-keypair-name>}"

STACK="${STACK:-gwave-livekit}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.large}"
SSH_CIDR="${SSH_CIDR:-0.0.0.0/0}"
API_KEY="${API_KEY:-APIgwave}"
API_SECRET="${API_SECRET:-$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40)}"
REGION_ARG=()
[ -n "${REGION:-}" ] && REGION_ARG=(--region "$REGION")

HERE="$(cd "$(dirname "$0")" && pwd)"

echo ">>> Deploying CloudFormation stack '${STACK}' for ${DOMAIN} ..."
aws cloudformation deploy \
  "${REGION_ARG[@]}" \
  --stack-name "$STACK" \
  --template-file "$HERE/livekit-cloudformation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DomainName="$DOMAIN" \
    LetsEncryptEmail="$EMAIL" \
    LivekitApiKey="$API_KEY" \
    LivekitApiSecret="$API_SECRET" \
    InstanceType="$INSTANCE_TYPE" \
    KeyName="$KEYPAIR" \
    SshCidr="$SSH_CIDR"

PUBLIC_IP="$(aws cloudformation describe-stacks "${REGION_ARG[@]}" \
  --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='PublicIp'].OutputValue" \
  --output text)"

cat <<DONE

>>> Stack deployed. Elastic IP: ${PUBLIC_IP}

Next:
  1) DNS: point ${DOMAIN}  A record  ->  ${PUBLIC_IP}
  2) Wait ~2 min for Caddy to issue the TLS certificate.
  3) Set these in the app server's .env and redeploy (bash deploy/server-deploy.sh):
        NEXT_PUBLIC_LIVEKIT_URL = wss://${DOMAIN}
        LIVEKIT_API_KEY         = ${API_KEY}
        LIVEKIT_API_SECRET      = ${API_SECRET}

Keep LIVEKIT_API_SECRET private — it can mint publish tokens.
DONE
