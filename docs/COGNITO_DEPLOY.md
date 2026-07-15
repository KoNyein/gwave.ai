# Cognito auth — enabling & testing

The code for **Supabase Third-Party Auth + Amazon Cognito** is in place behind a
switch. It stays **off** (app runs on Supabase Auth) until the env below is set.
Turn it on and test on **staging first** — never flip production blind.

## 1. Server `.env`

```bash
COGNITO_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=ap-southeast-1_krSbdHFs9
COGNITO_CLIENT_ID=5irdqjgs2mov5g68dvqtbjd8f2
COGNITO_CLIENT_SECRET=<the app client secret>
COGNITO_DOMAIN=https://gwave-auth.auth.ap-southeast-1.amazoncognito.com
NEXT_PUBLIC_COGNITO_ENABLED=1
```

`NEXT_PUBLIC_COGNITO_ENABLED` is baked in at build time, so a **rebuild** is
required: `bash deploy/server-deploy.sh`.

## 2. Supabase Dashboard — register Cognito (REQUIRED)

Without this, Supabase rejects Cognito tokens and every DB call 401s.

- Dashboard → **Authentication → Third-Party Auth → Add provider → AWS Cognito**
- **User Pool ID:** `ap-southeast-1_krSbdHFs9` · **Region:** `ap-southeast-1`
- Save.

## 3. Cognito App Client — Hosted UI / OAuth settings (REQUIRED)

Cognito console → User Pool → **App clients → gwave-web → Login pages** (edit)
must have:

- **Allowed callback URLs:** `https://gwave.cc/auth/callback`
  (add `http://localhost:3000/auth/callback` for local testing)
- **Allowed sign-out URLs:** `https://gwave.cc/login`
- **Identity providers:** Cognito user pool + Google
- **OAuth grant types:** Authorization code grant
- **OpenID Connect scopes:** openid, email, profile
- A **Hosted UI domain** must exist (`gwave-auth`).

Google IdP must be added under **Social and external providers** with the Google
client id/secret, and Google Cloud must allow the redirect
`https://gwave-auth.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse`.

## 4. Database migration

Apply `supabase/migrations/20260715120000_cognito_thirdparty_auth.sql` in the
Supabase SQL editor. It drops the `profiles.id → auth.users` foreign key (Cognito
users don't live in auth.users). Safe to apply before cutover.

## 5. Test on staging (in order)

1. `/login` → "Continue with Google" → Google → back to app, signed in.
2. New account → lands on `/onboarding`, "Save and continue" works (no
   profiles_id_fkey error).
3. Existing area works: open `/feed`, post, open `/messages` (RLS + Realtime).
4. `/api/debug/auth` → verdict `AUTH_OK`.
5. Wait > 60 min (or shorten token expiry) → app still works (middleware refresh).
6. Logout → returns to `/login`, session cleared.

## 6. Rollback

Remove the `COGNITO_*` + `NEXT_PUBLIC_COGNITO_ENABLED` env and rebuild — the app
returns to Supabase Auth immediately. The dropped FK is harmless under Supabase
Auth (the app always writes `id` = the authenticated user).

## What the code does

- `src/lib/cognito.ts` — Hosted UI OIDC (authorize/token/refresh/logout).
- `src/lib/cognito-session.ts` — token cookies (gw_at readable, gw_rt/gw_it
  httpOnly) + OAuth state (CSRF).
- `src/lib/supabase/{server,client}.ts` — attach the Cognito access token via the
  `accessToken` option so RLS/Realtime/Storage see `auth.uid()` = Cognito `sub`.
- `src/lib/auth.ts` — `getCurrentUser()` reads the Cognito session.
- `src/app/(auth)/actions.ts` — login/register/Google/logout → Hosted UI.
- `src/app/auth/callback/route.ts` — code exchange, session cookies, first-sign-in
  profile provisioning.
- `src/lib/supabase/middleware.ts` — edge-safe token refresh + route gating.

The 80-odd `supabase.auth.getUser()` call sites are unchanged: the Cognito token
is attached to every Supabase request, and Supabase validates it via the
third-party registration in step 2.

## Note — Myanmar SMS

Phone/SMS OTP stays **off** (AWS SMS doesn't reach Myanmar; see
AWS_MIGRATION_PLAN.md §4). Email + Google only for now.
