#!/usr/bin/env bash
# Gwave restore point — records the CURRENT state of production so that
# anything deleted afterwards can be identified and rebuilt.
#
# READ ONLY: it creates no AWS resources and deletes nothing. The snapshots
# themselves are taken in the AWS Console (see RESTORE.md) because the box's
# instance role should not hold image/snapshot rights — an AMI can be copied to
# another account, secrets and all.
#
# Run:  bash gwave-restore-point.sh
# Keep: the whole ~/gwave-restore-<date>/ folder, off the box as well.
set -uo pipefail

KEEP=i-0207c3c6180868996
REGIONS="ap-southeast-1 us-east-1 ap-southeast-7"
OUT="$HOME/gwave-restore-$(date -u +%Y%m%d-%H%M)"
mkdir -p "$OUT"
echo "Writing to $OUT"

# ---- 1. What the box is actually running -----------------------------------
{
  echo "# Host"; hostname; uname -a; date -u
  echo; echo "# Running containers (image + digest — the exact code in prod)"
  sudo docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo; echo "# Image digests"
  sudo docker images --digests --format '{{.Repository}}:{{.Tag}}\t{{.Digest}}\t{{.CreatedSince}}'
  echo; echo "# Docker volumes (Postgrest/Realtime/coturn state)"
  sudo docker volume ls
  echo; echo "# Listening ports"
  sudo ss -tlnp 2>/dev/null || sudo netstat -tlnp
  echo; echo "# Services"
  systemctl list-units --type=service --state=running --no-pager | head -40
} > "$OUT/host-state.txt" 2>&1

# ---- 2. Config file inventory — NAMES ONLY, never values -------------------
# The values live inside the AMI you are about to take; writing them to a text
# file would put every production secret in plain sight.
{
  echo "# /etc/gwave-web.env — variable NAMES only (values deliberately omitted)"
  sudo sed -E 's/=.*/=<redacted>/' /etc/gwave-web.env 2>/dev/null | sort
  echo; echo "# File list that matters if the box is rebuilt"
  ls -la /usr/local/bin/gwave-* 2>/dev/null
  sudo ls -la /etc/caddy/ 2>/dev/null
  sudo ls -la /etc/coturn/ 2>/dev/null || sudo ls -la /etc/turnserver.conf 2>/dev/null
} > "$OUT/config-inventory.txt" 2>&1

# ---- 3. DNS as it is right now ---------------------------------------------
{
  for h in gwave.cc www.gwave.cc; do echo "== $h"; getent hosts "$h"; done
} > "$OUT/dns.txt" 2>&1

# ---- 4. Full AWS inventory across every region in play ---------------------
{
for R in $REGIONS; do
  echo; echo "################ $R"
  echo "--- EC2 instances (KEEP $KEEP)"
  aws ec2 describe-instances --region "$R" \
    --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name,PublicIpAddress,PrivateIpAddress,Tags[?Key==`Name`]|[0].Value]' \
    --output text 2>&1
  echo "--- Root/data volumes per instance"
  aws ec2 describe-volumes --region "$R" \
    --query 'Volumes[].[VolumeId,Size,State,Attachments[0].InstanceId,Attachments[0].Device]' --output text 2>&1
  echo "--- Elastic / public IPs"
  aws ec2 describe-addresses --region "$R" \
    --query 'Addresses[].[PublicIp,AllocationId,InstanceId,AssociationId]' --output text 2>&1
  echo "--- Security groups on the app instance"
  aws ec2 describe-instances --region "$R" --instance-ids "$KEEP" \
    --query 'Reservations[].Instances[].SecurityGroups' --output text 2>&1
  echo "--- Existing AMIs owned by us"
  aws ec2 describe-images --region "$R" --owners self \
    --query 'Images[].[ImageId,Name,CreationDate]' --output text 2>&1
  echo "--- EBS snapshots"
  aws ec2 describe-snapshots --region "$R" --owner-ids self \
    --query 'Snapshots[].[SnapshotId,VolumeId,VolumeSize,StartTime,Description]' --output text 2>&1
  echo "--- RDS instances + existing snapshots"
  aws rds describe-db-instances --region "$R" \
    --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,Engine,EngineVersion,AllocatedStorage,MultiAZ,DBInstanceStatus,Endpoint.Address]' --output text 2>&1
  aws rds describe-db-snapshots --region "$R" --snapshot-type manual \
    --query 'DBSnapshots[].[DBSnapshotIdentifier,DBInstanceIdentifier,SnapshotCreateTime,Status]' --output text 2>&1
  echo "--- Load balancers / ECS / NAT"
  aws elbv2 describe-load-balancers --region "$R" --query 'LoadBalancers[].[LoadBalancerName,DNSName,Type,State.Code]' --output text 2>&1
  aws elb describe-load-balancers --region "$R" --query 'LoadBalancerDescriptions[].[LoadBalancerName,DNSName]' --output text 2>&1
  aws ecs list-clusters --region "$R" --query 'clusterArns' --output text 2>&1
  aws ec2 describe-nat-gateways --region "$R" --query 'NatGateways[?State==`available`].[NatGatewayId,VpcId]' --output text 2>&1
done
echo; echo "################ global"
echo "--- S3 buckets (NOT to be deleted — listed so the set is on record)"
aws s3api list-buckets --query 'Buckets[].[Name,CreationDate]' --output text 2>&1
echo "--- ECR images in gwave-web (the deployable code)"
aws ecr describe-images --region ap-southeast-1 --repository-name gwave-web \
  --query 'reverse(sort_by(imageDetails,&imagePushedAt))[:10].[imageTags[0],imageDigest,imagePushedAt]' --output text 2>&1
echo "--- CloudFront distributions"
aws cloudfront list-distributions --query 'DistributionList.Items[].[Id,DomainName,Aliases.Items[0],Status]' --output text 2>&1
echo "--- Route 53 zones"
aws route53 list-hosted-zones --query 'HostedZones[].[Id,Name]' --output text 2>&1
} > "$OUT/aws-inventory.txt" 2>&1

# ---- 5. Database logical backup — the one thing AWS snapshots can't replace
# if the RDS instance itself is ever deleted with its snapshots.
if [ -f /root/gwaveadmin_newpw.txt ] || sudo test -f /root/gwaveadmin_newpw.txt; then
  echo "Dumping the database (this can take a few minutes)…"
  DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
  sudo docker run --rm -e PGPASSWORD="$DBPASS" postgres:16 \
    pg_dump -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
      -U gwaveadmin -d gwave --no-owner --no-acl -Fc \
    > "$OUT/gwave-db.dump" 2>"$OUT/pg_dump.err"
  if [ -s "$OUT/gwave-db.dump" ]; then
    echo "  OK: $(du -h "$OUT/gwave-db.dump" | cut -f1)"
  else
    echo "  FAILED — see $OUT/pg_dump.err"
  fi
fi

echo
echo "=================================================================="
echo "Restore point recorded: $OUT"
ls -la "$OUT"
echo
echo "NOW DO THESE THREE IN THE AWS CONSOLE (see RESTORE.md):"
echo "  1. RDS snapshot        (user data)"
echo "  2. EC2 AMI, no-reboot  (whole server incl. /etc/gwave-web.env)"
echo "  3. Lightsail snapshots (only if you are deleting them)"
echo
echo "Then copy this folder OFF the box:"
echo "  scp -r ubuntu@$(getent hosts gwave.cc | awk '{print $1}'):$OUT ."
