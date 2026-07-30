#!/usr/bin/env bash
# Gwave AWS waste audit — READ ONLY. Deletes nothing.
# AccessDenied lines are fine: they only mean gwaveAppEc2Role can't read that
# service, so check it in the console instead.
KEEP=i-0207c3c6180868996          # the gwave.cc box — never touch
REGIONS="ap-southeast-1 us-east-1 ap-southeast-7"

for R in $REGIONS; do
  echo
  echo "################ $R"

  echo "--- EC2 instances (KEEP $KEEP)"
  aws ec2 describe-instances --region "$R" \
    --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name,PublicIpAddress,Tags[?Key==`Name`]|[0].Value]' \
    --output text 2>&1 | sed "s/^$KEEP/*** KEEP *** &/"

  echo "--- Elastic / public IPs"
  aws ec2 describe-addresses --region "$R" \
    --query 'Addresses[].[PublicIp,InstanceId,AssociationId]' --output text 2>&1

  echo "--- Unattached EBS volumes (pure waste)"
  aws ec2 describe-volumes --region "$R" --filters Name=status,Values=available \
    --query 'Volumes[].[VolumeId,Size,CreateTime]' --output text 2>&1

  echo "--- EBS snapshots owned by this account"
  aws ec2 describe-snapshots --region "$R" --owner-ids self \
    --query 'Snapshots[].[SnapshotId,VolumeSize,StartTime,Description]' --output text 2>&1 | head -20

  echo "--- Load balancers"
  aws elbv2 describe-load-balancers --region "$R" \
    --query 'LoadBalancers[].[LoadBalancerName,DNSName,Type,State.Code]' --output text 2>&1
  aws elb describe-load-balancers --region "$R" \
    --query 'LoadBalancerDescriptions[].[LoadBalancerName,DNSName]' --output text 2>&1

  echo "--- ECS clusters"
  aws ecs list-clusters --region "$R" --query 'clusterArns' --output text 2>&1

  echo "--- NAT gateways (should be none)"
  aws ec2 describe-nat-gateways --region "$R" \
    --query 'NatGateways[?State==`available`].[NatGatewayId,VpcId]' --output text 2>&1

  echo "--- RDS instances"
  aws rds describe-db-instances --region "$R" \
    --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]' --output text 2>&1
done
