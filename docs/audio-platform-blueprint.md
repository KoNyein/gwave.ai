# Gwave Audio Platform — Technical Blueprint & Implementation Strategy

**Scope:** integrate a full Audio Platform (Music · Podcasts · Audiobooks) into
the existing Gwave ecosystem — Next.js web (`gwave.cc`) + Flutter Android app
(`mobile/`), self-hosted PostgREST/Realtime over RDS Postgres, Cognito auth,
AWS on EC2/ECR, the G-Pay multi-currency wallet, and n8n automation.

> This blueprint is written to Gwave's actual conventions: **flat PostgREST
> queries (no hot-path resource embeds)**, **owner-only RLS**, **service-role
> tokens minted in `lib/auth/tokens.ts`** for privileged paths, runtime env in
> `/etc/gwave-web.env`, and SQL applied on EC2 via dockerised `psql` then
> `docker restart postgrest`. Nothing here introduces a second app, pipeline,
> or release channel.

---

## Section 1 — Architecture & International-Standards Compliance

### 1.1 Streaming pipeline (ingest → transcode → deliver)

```
Creator upload (web/app)
  │  PUT to S3 via presigned URL  (bucket: gwave-audio-src)
  ▼
S3 “source” bucket  ──(S3 ObjectCreated)──►  EventBridge rule
  │                                             │
  │                                             ▼
  │                                   AWS Elemental MediaConvert job
  │                                   • HLS (fMP4/CMAF) ladder:
  │                                       - 64 kbps  HE-AAC  (mobile data)
  │                                       - 128 kbps AAC-LC  (default)
  │                                       - 256 kbps AAC-LC  (premium/wifi)
  │                                   • 6 s segments, single audio rendition group
  │                                   • Optional CMAF + SPEKE DRM keys
  ▼
S3 “output” bucket (gwave-audio-hls)
  ▼
CloudFront distribution (audio.gwave.cc)
  • OAC (Origin Access Control) — S3 not public
  • Signed URLs / signed cookies for entitlement
  • Range-request + gzip on manifests
  ▼
Player: hls.js (web) / just_audio + flutter’s HLS (app)
```

**Why HLS + adaptive bitrate:** the same standard already used by Gwave Live
(`hls.js` on web, `video_player`/HLS on app). Reuse `src/lib/hls-quality.ts`
profiles — add an `attachAudioHls()` variant capped at audio renditions.

**MediaConvert job template (store as `AudioHLS-v1`):**

| Setting | Value |
|---|---|
| Container | CMAF (HLS + fMP4) |
| Audio codec | AAC-LC (+ HE-AAC v1 for the 64 kbps rung) |
| Segment length | 6 s, segmented output |
| Outputs | 64 / 128 / 256 kbps in one `#EXT-X-STREAM-INF` group |
| Encryption | SPEKE 2.0 → key provider (see DRM) for premium; **none** for free tier |
| Loudness | ITU-R BS.1770-4 normalisation to **−16 LUFS** (podcast/music), −18 LUFS (audiobooks) |

`−16 LUFS` is the de-facto international loudness target (Spotify/Apple), so
tracks don't jump in volume between formats.

### 1.2 Content protection (DRM)

Two tiers, chosen per `audio_tracks.protection`:

1. **Free / user-generated** → plain HLS behind **CloudFront signed URLs**
   (short-lived, entitlement-checked). No DRM overhead.
2. **Premium music & audiobooks** → **CMAF DRM via AWS SPEKE**:
   - **Google Widevine** (Android app, Chrome/Firefox/Edge web)
   - **Apple FairPlay** (Safari / iOS PWA)
   - One CMAF package, multi-key — MediaConvert calls a **SPEKE key server**
     (AWS provides a reference SPEKE implementation, or use a managed DRM vendor
     such as Axinom/EZDRM/PallyCon behind the SPEKE contract).

**License flow (never trust the client):**

```
App requests playback
  → GET /api/audio/{trackId}/manifest
      • verify Cognito session
      • verify entitlement (purchased OR active subscription OR free)
      • return CloudFront-signed manifest URL + DRM licenseServerUrl + token
  → Player requests DRM license
  → POST /api/audio/drm/license   (Widevine/FairPlay proxy)
      • re-verify entitlement server-side
      • forward to SPEKE/DRM vendor, return license
```

> DRM stops casual piracy of the decrypted stream. It is **not** a substitute
> for entitlement checks — always re-verify on the license endpoint.

### 1.3 Data privacy & security (GDPR + ISO/IEC 27001)

**Data minimisation & purpose limitation**

- Split *identity* from *behaviour*. Listening events reference `user_id` but
  live in `listen_events`, retained **13 months** then aggregated/anonymised by
  a scheduled job (`pg_cron` / n8n nightly).
- Store a **consent ledger** (`audio_consents`) — analytics, personalised
  recommendations, and marketing are **separate opt-ins**, timestamped, with the
  policy version. Default = off for anything beyond core playback.

**Data-subject rights (GDPR Art. 15–20)**

| Right | Mechanism |
|---|---|
| Access / Portability | `GET /api/me/audio/export` → JSON of purchases, playlists, progress, listen history |
| Erasure | `DELETE /api/me/audio` → hard-delete PII rows, keep **pseudonymised** financial records for legal retention |
| Rectification | standard profile edit |
| Restriction / Objection | toggle in `audio_consents` |

**Security controls (ISO/IEC 27001 Annex A mapping)**

- **A.9 Access control** — owner-only RLS on every personal table; PostgREST
  reads with the caller's `gw_at`; privileged writes use the service-role token
  path, never a static key.
- **A.10 Cryptography** — TLS 1.2+ everywhere; RDS encrypted at rest (KMS);
  S3 SSE-KMS; wallet/txn columns never logged.
- **A.12 Logging** — append-only `audio_audit_log` for purchases, refunds,
  entitlement grants (who/what/when, no card data).
- **A.14 Secure dev** — CI Lint/Typecheck/Build + Smoke E2E gate every merge
  (already enforced); dependency scanning (Dependabot already on).
- **A.18 Compliance** — DPA/records-of-processing documented; data resides in
  `ap-southeast-1`.

### 1.4 Accessibility (WCAG 2.1 AA)

- **Perceivable** — every control has a text label; cover art `alt`; captions/
  transcripts for podcasts (store `transcript_url`); contrast ≥ 4.5:1 (audit
  the green theme in dark mode — same fix already applied elsewhere).
- **Operable** — full keyboard operation of the player (Space = play/pause,
  ←/→ = seek, J/L = ±10 s); visible focus rings; **no seizure risk** (no
  flashing); target size ≥ 44×44 px (matches the WHM trainer's touch targets).
- **Understandable** — consistent nav across the three formats; plain-language
  errors ("Purchase failed — your wallet balance is 3.20 USD, this album is
  4.99 USD").
- **Robust** — semantic HTML5 `<audio>`/ARIA `role="slider"` with
  `aria-valuenow`/`aria-valuetext` on the scrubber; screen-reader announcements
  on chapter change (`aria-live="polite"`).
- **App parity** — Flutter `Semantics()` labels on every player button;
  `just_audio` + `audio_service` expose the media session to TalkBack and the
  lock-screen/notification controls.

---

## Section 2 — Database Schema & Unified Playback State

Postgres (the existing RDS instance), consumed through PostgREST. **Flat
tables, assembled in code** — no hot-path embeds (a stale schema cache would
500 them, the exact failure mode that has bitten messenger/notifications).

### 2.1 Core schema (SQL bundle → run on EC2)

```sql
-- One row per playable item, regardless of format.
create table if not exists public.audio_tracks (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('music','podcast','audiobook')),
  title        text not null,
  description  text,
  cover_url    text,
  duration_s   integer,                         -- total seconds
  hls_url      text,                            -- CloudFront manifest
  transcript_url text,                          -- WCAG: podcasts/audiobooks
  protection   text not null default 'free'
                 check (protection in ('free','signed','drm')),
  price_minor  integer,                         -- a-la-carte price, minor units
  price_ccy    text,                            -- 'USD','THB','MMK'…
  is_premium   boolean not null default false,
  publisher_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- MUSIC facet
create table if not exists public.audio_music (
  track_id uuid primary key references public.audio_tracks(id) on delete cascade,
  artist   text not null,
  album    text,
  genre    text,
  isrc     char(12),                            -- International Std Recording Code
  track_no integer
);

-- PODCAST facet (+ the show it belongs to)
create table if not exists public.podcast_shows (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  author     text,
  rss_url    text unique,                       -- for RSS import/sync
  category   text,
  cover_url  text,
  created_at timestamptz not null default now()
);
create table if not exists public.audio_podcast (
  track_id   uuid primary key references public.audio_tracks(id) on delete cascade,
  show_id    uuid not null references public.podcast_shows(id) on delete cascade,
  episode_no integer,
  season_no  integer,
  show_notes text,
  guid       text                               -- RSS <guid> for dedupe
);

-- AUDIOBOOK facet (+ chapters)
create table if not exists public.audio_audiobook (
  track_id uuid primary key references public.audio_tracks(id) on delete cascade,
  author   text not null,
  narrator text,
  isbn     text,                                -- ISBN-13
  publisher text
);
create table if not exists public.audio_chapters (
  id       uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  idx      integer not null,                    -- 0-based order
  title    text not null,
  start_s  integer not null,                    -- offset within the file
  unique (track_id, idx)
);

create index if not exists audio_tracks_kind    on public.audio_tracks (kind, published_at desc);
create index if not exists audio_music_artist   on public.audio_music (artist);
create index if not exists audio_podcast_show    on public.audio_podcast (show_id, episode_no);
create index if not exists audio_chapters_track on public.audio_chapters (track_id, idx);
```

### 2.2 Playback-sync engine (resume across devices)

The critical piece for audiobooks/podcasts. **One row per (user, track)**,
upserted — the server keeps the newest position; conflicts resolve by
`updated_at` (last-write-wins is fine for a single human on 2 devices).

```sql
create table if not exists public.audio_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  track_id    uuid not null references public.audio_tracks(id) on delete cascade,
  position_s  integer not null default 0,       -- exact resume point
  duration_s  integer,                          -- snapshot for % complete
  chapter_idx integer,
  speed       numeric(3,2) default 1.0,         -- remembered playback rate
  completed   boolean not null default false,
  device      text,                             -- last device that wrote
  updated_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index if not exists audio_progress_recent
  on public.audio_progress (user_id, updated_at desc);

alter table public.audio_progress enable row level security;
create policy audio_progress_own on public.audio_progress
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.audio_progress to authenticated;
```

**Client write strategy (battery- and network-friendly):**

- Throttle: upsert every **10 s of playback** and on **pause / seek / app
  background / track change**. Debounce so a burst of seeks = one write.
- Endpoint (flat upsert, `Prefer: resolution=merge-duplicates` on
  `user_id,track_id`):

```http
POST /sb/rest/v1/audio_progress?on_conflict=user_id,track_id
Prefer: resolution=merge-duplicates
{ "user_id":"…","track_id":"…","position_s":734,"duration_s":5400,
  "chapter_idx":3,"speed":1.5,"device":"pixel-8" }
```

**Resume on open:** `GET /audio_progress?user_id=eq.…&order=updated_at.desc`
→ the app seeks to `position_s` (minus a 3 s "re-entry" rewind, a UX nicety).
This mirrors the mobile **HealthStore cloud-restore** pattern just shipped —
same "auto-save / auto-update / restore across devices" guarantee.

**Realtime (optional):** subscribe to `audio_progress` on the self-hosted
Realtime channel so a second logged-in device live-updates its resume point.

---

## Section 3 — E-commerce & Multi-currency Wallet (G-Pay) Integration

### 3.1 Entitlement model

```sql
-- A-la-carte ownership (one album/audiobook/episode) — permanent.
create table if not exists public.audio_entitlements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  track_id   uuid not null references public.audio_tracks(id) on delete cascade,
  source     text not null check (source in ('purchase','subscription','gift','free')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,                        -- null = perpetual
  unique (user_id, track_id, source)
);

-- Subscription (monthly all-access) — time-boxed.
create table if not exists public.audio_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  plan       text not null,                      -- 'audio_monthly','audio_annual'
  status     text not null default 'active',     -- active|past_due|canceled
  renews_at  timestamptz,
  ccy        text not null,
  created_at timestamptz not null default now()
);
```

Entitlement check (server-side, on manifest + license): user is entitled if
**any** — a matching `audio_entitlements` row (unexpired) **OR** an `active`
`audio_subscriptions` row **OR** the track is `free`.

### 3.2 Transaction flow (a-la-carte)

```
POST /api/audio/{trackId}/purchase        (Cognito session required)
  1. Load track → price_minor, price_ccy.
  2. Read user wallet balance in price_ccy (G-Pay ledger).
       • If insufficient → 402 with { need, have, ccy } → client offers top-up.
  3. BEGIN (single DB txn / RPC):
       • debit wallet   (wallet_ledger: -price, memo 'audio:{trackId}')
       • insert audio_entitlements(source='purchase')
       • insert audio_audit_log
     COMMIT  — atomic: no debit without entitlement, no entitlement without debit.
  4. Return { entitled:true, receiptId }.
```

Implement step 3 as a **Postgres function (RPC)** called via PostgREST so the
debit + grant are one transaction with `SECURITY DEFINER` and an explicit
balance re-check inside — never do the two writes as separate client calls.

```sql
create or replace function public.buy_audio(p_track uuid)
returns table (entitled boolean, receipt uuid)
language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_price int; v_ccy text; v_bal int;
begin
  select price_minor, price_ccy into v_price, v_ccy
    from public.audio_tracks where id = p_track;
  if v_price is null then raise exception 'not_purchasable'; end if;
  select balance_minor into v_bal
    from public.wallet_balances where user_id = v_user and ccy = v_ccy for update;
  if coalesce(v_bal,0) < v_price then raise exception 'insufficient_funds'; end if;
  -- debit + grant + audit (wallet_ledger insert triggers balance update)
  insert into public.wallet_ledger(user_id,ccy,amount_minor,memo)
    values (v_user, v_ccy, -v_price, 'audio:'||p_track);
  insert into public.audio_entitlements(user_id,track_id,source)
    values (v_user, p_track, 'purchase')
    on conflict do nothing;
  return query select true, gen_random_uuid();
end $$;
```

> Adapt `wallet_balances` / `wallet_ledger` to the **actual** G-Pay table names.
> Currency conversion (buy a USD album from an MMK balance) should reuse the
> existing `currency_rates` table + the same rounding rule the wallet already
> uses — don't invent a second FX path.

### 3.3 Subscription flow

- **Purchase/renew:** monthly debit via the same wallet RPC (`buy_subscription`),
  or Stripe for card-holders (Stripe is already wired — reuse the
  signature-verified webhook).
- **Renewal automation:** an **n8n cron** (daily) finds `renews_at <= now()`,
  attempts the wallet debit, sets `status='past_due'` on failure and fires the
  dunning notification. Grace period 3 days before `canceled`.
- **Entitlement is derived, not copied** — never write per-track rows for
  subscribers; the check queries `audio_subscriptions` live, so a lapse
  instantly revokes access.

---

## Section 4 — Help Functions & Workflow Automation (n8n.io)

### 4.1 In-app support tickets → n8n

```
User taps “Get help” (Help Center)
  → POST /api/support/audio    { category, trackId?, orderId?, message, deviceInfo }
      • insert support_tickets(status='open')            (system of record)
      • POST webhook → n8n  (HMAC-signed X-Gwave-Signature header)
  → 202 Accepted (ticket id shown to user)

n8n workflow “audio-support-triage”
  ┌─ Webhook (verify HMAC)
  ├─ Switch on {category}
  │   • “Failed purchase”  → Function: look up wallet_ledger + audio_audit_log
  │                          → if debit w/o entitlement → auto-refund RPC + notify “resolved”
  │                          → else → route to Finance queue
  │   • “Audio not playing” → check CloudFront/Media health → send troubleshooting
  │                          steps (bitrate, DRM, offline) → if unresolved escalate
  │   • “Content request / other” → AI triage node (LLM) classifies + drafts reply
  ├─ Human-in-the-loop: create card in support tool (e.g. email/Slack/DB)
  └─ Respond: PATCH /api/support/{id} status + push notification to user
```

**Security:** the webhook verifies an HMAC over the raw body with a shared
secret in `/etc/gwave-web.env` (`N8N_WEBHOOK_SECRET`); n8n calls back through a
scoped service token, not a user session.

**AI triage node:** classify into {billing, playback, content, account},
sentiment, and a suggested resolution; only *auto-act* on safe, reversible
cases (e.g. refund a proven double-charge); everything else drafts a reply for
a human to approve.

### 4.2 Automated feedback loop (rate after completion)

```
audio_progress.completed flips false→true   (DB trigger)
  → NOTIFY / outbox row  → n8n “audio-completion” workflow
      ├─ Wait node: delay 30 min (let them finish reflecting)
      ├─ Check: not already rated? push consent on?
      ├─ Web Push / FCM: “Enjoyed {title}? Tap to rate ⭐”
      └─ Deep link → in-app rating sheet → POST /api/audio/{id}/rating
```

Reuse the existing **web-push (VAPID)** + app push plumbing; the rating writes
to a `audio_ratings` table that feeds the store's “Top rated” rails.

---

## Section 5 — End-User Guide (the Music Store Manual)

> Drop this straight into the app's **Help / FAQ** section (localise via the
> `wellnessBreath`-style i18n namespace, e.g. `audioHelp.*`, so it follows the
> Myanmar/English toggle).

### 🎧 Welcome to Gwave Audio

Music, Podcasts and Audiobooks — all in one place, paid for with your Gwave
wallet.

#### 1. Discover & Browse
1. Open **Audio** from the main menu.
2. Use the top tabs to switch between **Music**, **Podcasts** and **Audiobooks**.
3. Browse the rails — *New*, *Top rated*, *Continue listening* (your unfinished
   audiobooks/podcasts appear here automatically).
4. Tap **Search** to find by title, artist, author, narrator or show.

#### 2. Purchasing & Wallet Top-up
1. Open any premium item and tap **Buy** (single album/audiobook) or
   **Subscribe** (monthly all-access).
2. If your balance is too low, you'll see **Top up** — add funds in your
   currency (USD / THB / MMK …); the price converts automatically.
3. Confirm — the amount is deducted from your wallet and the item unlocks
   instantly. Find receipts under **Wallet → History**.

#### 3. Advanced Player Controls
- **Playback speed:** tap **1×** to cycle **1× → 1.2× → 1.5× → 2×** — great for
  podcasts and audiobooks.
- **Sleep timer:** tap the **moon** icon → choose 15/30/45 min or *end of
  chapter*; audio fades out and pauses.
- **Chapters:** tap the **list** icon to jump between chapters; **⏭ / ⏮** skip a
  chapter, the **±15 s** buttons nudge within one.
- **Resume anywhere:** stop on your phone, continue on the web — it picks up at
  the exact second you left off.

#### 4. Offline Listening
1. On a purchased item, tap **⬇ Download**.
2. Choose quality (Standard / High) — files are stored **encrypted inside the
   app**, not in your gallery, and won't play outside Gwave.
3. Manage space under **Settings → Downloads**; downloads for expired
   subscriptions are removed automatically.

#### 5. Getting Help
1. Go to **Help Center → Audio**.
2. Pick a topic — *Failed purchase*, *Audio not playing*, *Refund*, *Other*.
3. Send your message; you'll get a ticket number and a reply in-app (and a push
   notification when it's answered). Failed-payment issues are often resolved
   automatically within minutes.

---

## Implementation roadmap (suggested order)

| Phase | Deliverable | Notes |
|---|---|---|
| 0 | SQL bundles (§2, §3) applied on RDS + `docker restart postgrest` | owner-only RLS, `buy_audio` RPC |
| 1 | Ingest + MediaConvert `AudioHLS-v1` + CloudFront `audio.gwave.cc` | free tier first (no DRM) |
| 2 | Web player (`attachAudioHls`) + browse/search + progress sync | reuse `hls-quality.ts` |
| 3 | Flutter player (`just_audio` + `audio_service`) + resume + offline | media session + Semantics |
| 4 | Wallet purchase + subscription + entitlement gating | RPC-atomic, reuse `currency_rates` |
| 5 | DRM (SPEKE → Widevine/FairPlay) for premium | manifest + license proxy |
| 6 | n8n support triage + completion-rating flows | HMAC webhook, VAPID/FCM push |
| 7 | GDPR export/erase endpoints + consent UI + WCAG audit | accessibility sign-off |

**Env to add to `/etc/gwave-web.env`:** `AUDIO_S3_SRC_BUCKET`,
`AUDIO_S3_HLS_BUCKET`, `AUDIO_CLOUDFRONT_DOMAIN`, `AUDIO_CF_KEYPAIR_ID`,
`AUDIO_CF_PRIVATE_KEY`, `MEDIACONVERT_ROLE_ARN`, `MEDIACONVERT_ENDPOINT`,
`DRM_SPEKE_URL` / vendor keys, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`.
CloudFront/MediaConvert are runtime-only → `sudo gwave-redeploy` suffices; a new
`NEXT_PUBLIC_AUDIO_CDN` would need an image rebuild.

**Standards checklist:** HLS (RFC 8216) · AAC/HE-AAC · BS.1770 loudness ·
Widevine/FairPlay DRM · ISRC/ISBN metadata · GDPR Art. 15–20 · ISO/IEC 27001
Annex A · WCAG 2.1 AA · TLS 1.2+ · KMS-encrypted S3/RDS.
