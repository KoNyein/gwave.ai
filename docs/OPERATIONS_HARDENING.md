# Gwave AWS Operations Hardening

This runbook keeps the platform compact: one web deployment, one RDS database,
one self-hosted PostgREST/Realtime data plane, S3/CloudFront media, and AWS-native
monitoring. Do not add queues or functions unless a measured bottleneck requires it.

## Required production controls

### CloudWatch
- Ship application, Caddy, PostgREST, Realtime, and PostgreSQL logs to CloudWatch.
- Add alarms for HTTP 5xx, health endpoint failures, RDS CPU/connections/storage,
  Cognito sign-in failures, and S3 upload failures.
- Include a request/correlation ID in application and proxy logs.

### Health checks
- Poll `/api/health` every minute from the deployment platform or Route 53 health checks.
- Alert after three consecutive failures.
- The endpoint is a liveness and data-plane reachability probe; it is not an admin status page.

### Backups
- Enable RDS automated backups and point-in-time recovery.
- Take a manual snapshot before destructive or large migrations.
- Enable S3 versioning and lifecycle rules for media and recordings.
- Perform a restore drill monthly and record recovery time.

### Secrets
- Store Cognito client secret, JWT signing key, integration secrets, and webhook secrets
  in AWS Secrets Manager or SSM Parameter Store.
- Grant read access only through the EC2 instance role.
- Never pass server secrets as Docker build arguments.

### Edge protection
- Put AWS WAF in front of public traffic when CloudFront or an ALB is used.
- Rate-limit authentication, OTP, password reset, upload, messaging, payment,
  support, and notification endpoints.
- Keep endpoint authorization and RLS checks even when WAF is enabled.

## Deployment sequence

1. Build and scan the image in CI.
2. Snapshot RDS before migrations that alter existing data.
3. Run `infra/postgres/migrate.sh` exactly once using the deployment role.
4. Deploy the new image.
5. Verify `/api/health`, login, feed, messaging, media upload, and payment smoke paths.
6. Roll back the image if health checks fail; restore the snapshot only for data damage.

## Feature kill switches

The server reads these optional variables. Defaults preserve existing production behaviour.

- `FEATURE_DROPSHIPPING=false`
- `FEATURE_IVS_LIVE=true`
- `FEATURE_CHIME_CALLS=false`
- `FEATURE_CCTV=true`
- `FEATURE_HEALTH=true`

Use kill switches for incidents. They do not replace user authorization or database RLS.

## Provider consolidation target

- Calls: Amazon Chime SDK
- Live: Amazon IVS
- CCTV: Amazon Kinesis Video Streams
- Auth: Amazon Cognito
- Database: Amazon RDS PostgreSQL
- Media: Amazon S3 and CloudFront

Retire legacy providers only after production usage telemetry confirms no active path depends on them.
