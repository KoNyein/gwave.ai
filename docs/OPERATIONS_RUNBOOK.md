# Operations Runbook — Cognito + self-hosted Supabase

This app runs a **split backend**. Knowing which service handles what is the key
to debugging production, because a request that "should" go to one place often
goes to another.

> **No secrets in this file.** It lives in a public repo. Everything below is
> referenced by env-var name or fingerprint (`sha256 | cut -c1-12`), never by
> value. Actual secrets live only in the EC2 host's `deploy/gwave.override.env`,
> the running containers, and the RDS/Supabase consoles.

## Architecture at a glance

| Concern            | Where it runs                                   | Auth it trusts |
|--------------------|-------------------------------------------------|----------------|
| Login / identity   | **Amazon Cognito** (Hosted UI, OIDC)            | Cognito cookies `gw_at`/`gw_it`/`gw_rt` |
| Database (REST)    | **self-hosted PostgREST** on EC2 → AWS **RDS**  | HS256 JWT (shared secret) |
| Realtime           | **self-hosted** `supabase/realtime` on EC2      | HS256 JWT (shared secret) |
| Storage (files)    | **Supabase Cloud** project                      | Cloud's own JWT secret / service key |
| Auth API (`/auth`) | Supabase Cloud (unused — Cognito replaces it)   | — |

Caddy (`/etc/caddy/Caddyfile`) routes `NEXT_PUBLIC_SUPABASE_URL` (`…/sb`):

```
/sb/rest/v1/*      → 127.0.0.1:3005  (PostgREST → RDS)
/sb/realtime/v1/*  → 127.0.0.1:4000  (Realtime)
/sb/*  (storage,…) → Supabase Cloud project
```

## The one invariant that must always hold

The browser and server mint **HS256** Supabase-native JWTs. Three services each
verify that signature, so **all three must trust the same secret**:

```
web  SUPABASE_JWT_SECRET   ==   realtime  API_JWT_SECRET   ==   PostgREST oct key
```

- PostgREST verifies via `PGRST_JWT_SECRET=@/etc/postgrest/jwks.json`. That JWKS
  must contain an **`oct`** key whose `k` = `base64url(<the secret bytes>)`.
- If any of the three drifts, every authenticated call fails with **401
  `JWSInvalidSignature`** (PostgREST) or **"alg/ signature" errors** (Realtime).

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

Storage is on the Cloud project, which validates JWTs with a secret we don't
hold — so the browser **cannot** upload directly under Cognito (it fails with
`signature verification failed`). Uploads therefore go **server-side**:

- `POST /api/upload?bucket=media|slips&ext=<ext>` (`src/app/api/upload/route.ts`)
  writes with the Cloud **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`,
  `sb_secret_…`), which Cloud accepts. The object path is derived from the
  **session** user, never the client.
- `src/lib/media.ts` (`uploadViaServer`) and the slip forms call this when the
  `gw_at` cookie is present (Cognito). Non-Cognito keeps direct browser upload.
- Private-bucket reads (admin slip review, GPay KYC) sign URLs with the service
  key via `src/lib/storage-signed.ts`.
- `media` bucket reads are public URLs (`/storage/v1/object/public/media/…`);
  the bucket's `public=true` flag serves them without an RLS policy.

Confirm the Cloud service key still works:

```bash
SVC=$(sudo docker exec gwave-web printenv SUPABASE_SERVICE_ROLE_KEY | tr -d '\n')
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  '<CLOUD_PROJECT_URL>/storage/v1/object/list/media' \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":1}'   # expect 200
```

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
5. **Long-term: self-host Storage** to drop the Cloud dependency. Requires
   migrating existing objects out of the Cloud `media`/`slips` buckets first.

## Symptom → cause quick reference

| Symptom | Likely cause |
|---|---|
| `401 JWSInvalidSignature` on `/sb/rest` | PostgREST oct key ≠ current secret |
| Realtime "alg/ signature" errors | `API_JWT_SECRET` ≠ current secret |
| `signature verification failed` on upload | Direct browser upload to Cloud storage (should go via `/api/upload`) |
| `permission denied for table X` | Missing table GRANT to `anon`/`authenticated`/`service_role` |
| `new row violates row-level security` | Service role not bypassing RLS, or missing INSERT policy |
| Images blank after a deploy | Stale JS chunks (deploy skew) — hard reload |
