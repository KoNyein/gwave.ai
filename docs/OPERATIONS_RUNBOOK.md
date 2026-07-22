# Operations Runbook — Cognito + self-hosted data API (PostgREST + Realtime)

This app runs an **all-AWS backend**. Knowing which service handles what is the
key to debugging production, because a request that "should" go to one place
often goes to another.

> **There is no Supabase project.** gwave left the hosted service on 2026-07-17:
> database on RDS, data API self-hosted (PostgREST + Realtime) behind
> `https://gwave.cc/sb`, storage on S3 + CloudFront, auth on Cognito. The
> `@supabase/supabase-js` package is kept **on purpose** — it is a
> PostgREST/Realtime client, which is exactly what our AWS endpoints speak. Do
> not go looking for a Supabase dashboard, and do not debug the dead hosted
> Supabase Google OAuth client.

> **No secrets in this file.** It lives in a public repo. Everything below is
> referenced by env-var name or fingerprint (`sha256 | cut -c1-12`), never by
> value. Actual secrets live only in the EC2 host's `deploy/gwave.override.env`,
> the running containers, and the AWS consoles.

## Architecture at a glance

| Concern            | Where it runs                                   | Auth it trusts |
|--------------------|-------------------------------------------------|----------------|
| Login / identity   | **Amazon Cognito** (Hosted UI, OIDC)            | Cognito cookies `gw_at`/`gw_it`/`gw_rt` |
| Database (REST)    | **self-hosted PostgREST** on EC2 → AWS **RDS**  | our ES256 data token, verified via our JWKS |
| Realtime           | **self-hosted** `supabase/realtime` on EC2 (the OSS server — not the hosted service) | our ES256 data token / the legacy HS256 anon key |
| Storage (files)    | **S3 + CloudFront** (`d10t7bibe827e7.cloudfront.net`) | IAM (EC2 instance role) + presigned URLs |

Caddy (`/etc/caddy/Caddyfile`) routes `NEXT_PUBLIC_DATA_API_URL` (`…/sb`) — the
env var was renamed from `NEXT_PUBLIC_SUPABASE_URL`, which is still accepted as a
fallback (`src/lib/env.ts`):

```
/sb/rest/v1/*      → 127.0.0.1:3005  (PostgREST → RDS)
/sb/realtime/v1/*  → 127.0.0.1:4000  (Realtime)
```

Files do **not** go through `/sb` any more — they are on S3, served through
CloudFront.

## The one invariant that must always hold

> **Current state:** the server mints an **ES256** data token
> (`src/lib/auth/tokens.ts`, signed with `APP_JWT_PRIVATE_KEY`, claims
> `sub` = `profiles.id`, `role` = `authenticated`) and PostgREST/Realtime verify
> it against our **JWKS** (`APP_JWT_PUBLIC_JWK`'s `kid`). The HS256 shared
> secret below is the **legacy anon key** path that still lives in the same
> JWKS as an `oct` key (see `deploy/postgrest-add-hs256-key.sh`) — keep it in
> sync while it is still in use; it is no longer what authenticates a user.

The HS256 (anon-role) JWTs are verified by three services, so **all three must
trust the same secret**:

```
web  SUPABASE_JWT_SECRET   ==   realtime  API_JWT_SECRET   ==   PostgREST oct key
```

- PostgREST verifies via `PGRST_JWT_SECRET=@/etc/postgrest/jwks.json`. That JWKS
  must contain an **`oct`** key whose `k` = `base64url(<the secret bytes>)`.
- If any of the three drifts, every call made with the anon key fails with **401
  `JWSInvalidSignature`** (PostgREST) or **"alg/ signature" errors** (Realtime) —
  including the Realtime socket handshake, which decodes `NEXT_PUBLIC_DATA_API_KEY`.

Check they match (expect one identical fingerprint on all three):

```bash
# web
sudo docker exec gwave-web printenv SUPABASE_JWT_SECRET | tr -d '\n' | sha256sum | cut -c1-12
# realtime
sudo docker inspect realtime --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^API_JWT_SECRET=' | cut -d= -f2- | tr -d '\n' | sha256sum | cut -c1-12
# postgrest oct key (compare k → decodes to the same secret)
sudo python3 -c "import json,base64,hashlib; d=json.load(open('/etc/postgrest/jwks.json')); \
ks=d.get('keys',d if isinstance(d,list) else [d]); \
[print(hashlib.sha256(base64.urlsafe_b64decode(k['k']+'==').decode().encode()).hexdigest()[:12]) \
 for k in ks if k.get('kty')=='oct']"
```

### Re-point PostgREST's oct key to the current secret

If PostgREST rejects freshly minted tokens, its oct key is stale. Re-derive it
from the running web secret and restart:

```bash
sudo docker exec gwave-web printenv SUPABASE_JWT_SECRET | tr -d '\n' | sudo tee /tmp/sec.txt >/dev/null
sudo python3 -c "import json,base64; sec=open('/tmp/sec.txt','rb').read().strip(); \
k=base64.urlsafe_b64encode(sec).rstrip(b'=').decode(); p='/etc/postgrest/jwks.json'; \
d=json.load(open(p)); ks=d['keys'] if isinstance(d,dict) and 'keys' in d else d; \
[key.update({'k':k}) for key in ks if key.get('kty')=='oct']; json.dump(d,open(p,'w'))"
sudo docker restart postgrest
```

## Storage / file uploads

Storage cut over to **S3 + CloudFront** on 2026-07-17. `NEXT_PUBLIC_S3_CDN` (the
CloudFront domain) is the flag that selects the S3 path — it is **set in
production**:

- **Writes**: the browser asks `POST /api/storage/presign` for a presigned PUT
  and uploads straight to S3 (`putObject` in `src/lib/media.ts`). The object key
  is derived from the **session** user, never the client. Server credentials come
  from the **EC2 instance role** — no static keys.
- **Public reads** (`media`): CloudFront URLs built by `src/lib/media-url.ts`.
- **Private reads** (admin slip review, GPay KYC): short-lived signed S3 GET URLs
  from `src/lib/storage/signed-read.ts` (`AWS_S3_SLIPS_BUCKET`).
- **Chat attachments**: private bucket, read back through `/api/media/chat`.

The legacy Supabase-Storage branch in `src/lib/media.ts` only runs when
`NEXT_PUBLIC_S3_CDN` is unset (pre-cutover installs); production never takes it.

## Deploy

1. Push to the active branch → GitHub Actions (`.github/workflows/deploy-ecr.yml`)
   builds and pushes the image to ECR.
2. On EC2, redeploy onto the new image (snapshots env, applies overrides):
   ```bash
   sudo bash /home/ubuntu/app/gwave.ai/deploy/ecr-redeploy.sh
   ```
3. Verify the digest changed and the secret fingerprint is unchanged.

DB-only or storage-policy-only changes need **no** redeploy.

> ⚠️ Redeploy right after a push can pull the **old** image if the build hasn't
> finished. Wait for the Actions run to go green first.

### Rebuilding the ad-hoc containers (realtime / postgrest)

`realtime` and `postgrest` run as plain `docker run` (no compose), so their
config — RDS password, `API_JWT_SECRET`, oct key — lives only in the running
containers. If the box is lost, capture is gone. To make them rebuildable:

- **Realtime**: `deploy/realtime-run.sh` recreates it from `deploy/.env.realtime`
  (gitignored). Capture that file once from the live container (see the script
  header), store it in a secrets manager, then relaunch with
  `sudo bash deploy/realtime-run.sh`.
- **PostgREST**: not yet scripted — capture its env the same way
  (`docker inspect postgrest …`) and mirror the realtime launcher. Its
  `PGRST_JWT_SECRET=@/etc/postgrest/jwks.json` bind mount must also be preserved
  (that JWKS holds the oct key — see the invariant above).

## Pending follow-ups (need console access)

1. **Rotate the RDS password** — it was exposed in a chat transcript.
   1. RDS console → modify the DB instance → set a new master password → apply immediately.
   2. Update `deploy/gwave.override.env` (`DATABASE_URL` / PG creds) on EC2.
   3. Update the `realtime` container's `DB_PASSWORD` (and any other consumer).
   4. `sudo bash deploy/ecr-redeploy.sh` and restart `realtime` + `postgrest`.
   5. Smoke-test: login, feed, a write (SOS/PTT), an upload.
2. **Make the repo private again** — GitHub → Settings → Danger Zone →
   Change visibility.
3. **Revert the temporary feature-branch trigger** in `deploy-ecr.yml` once work
   consolidates onto `main`.
4. **Reconcile `main`** with the fixes on the feature branch.
5. ~~**Long-term: self-host Storage** to drop the Cloud dependency.~~ **Done
   2026-07-17** — storage runs on S3 + CloudFront; no Supabase dependency left.

## Symptom → cause quick reference

| Symptom | Likely cause |
|---|---|
| `401 JWSInvalidSignature` on `/sb/rest` | PostgREST's JWKS doesn't hold our current ES256 public key (`kid` mismatch), or the legacy oct key ≠ current secret |
| Realtime "alg/ signature" errors | `API_JWT_SECRET` ≠ current secret |
| Upload fails / `Upload failed.` | `/api/storage/presign` rejected the request, or the EC2 instance role lost S3 write permission |
| `permission denied for table X` | Missing table GRANT to `anon`/`authenticated`/`service_role` |
| `new row violates row-level security` | Service role not bypassing RLS, or missing INSERT policy |
| Images blank after a deploy | Stale JS chunks (deploy skew) — hard reload |
