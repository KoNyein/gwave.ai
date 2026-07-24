# Audio support & feedback automation (n8n)

The audio store's Help Center records a ticket in `public.support_tickets`
(system of record) and fires an **n8n webhook** for triage. This doc covers the
setup and the two workflows.

## Setup

1. Apply `supabase/sql-editor-bundles/audio-support.sql` on RDS, then
   `sudo docker restart postgrest`.
2. Add to `/etc/gwave-web.env` and `sudo gwave-redeploy`:
   ```
   N8N_WEBHOOK_URL=https://<your-n8n>/webhook/gwave-audio
   N8N_WEBHOOK_SECRET=<a long random string>
   ```
   Both are read at runtime. With no `N8N_WEBHOOK_URL` set, ticketing still
   works — the webhook is simply skipped (best-effort).

## Event envelope

`POST {N8N_WEBHOOK_URL}` with header `X-Gwave-Signature: <hex hmac-sha256>` of
the raw body, keyed by `N8N_WEBHOOK_SECRET`. Body:

```json
{
  "event": "support.audio.created",
  "at": "2026-07-24T10:00:00.000Z",
  "payload": {
    "ticketId": "…", "userId": "…", "category": "playback",
    "subject": null, "message": "…", "trackId": "…"
  }
}
```

Verify in n8n's first node: recompute the HMAC over the raw body with the shared
secret and compare — reject on mismatch.

## Workflow 1 — `audio-support-triage`

```
Webhook (verify HMAC)
  └─ Switch on payload.category
       • "purchase" → Function: look up wallet_ledger + audio entitlement for the
                       user; if a debit exists with no matching entitlement →
                       call an auto-refund, reply "resolved". Else → Finance queue.
       • "playback" → send templated troubleshooting steps (bitrate, DRM, offline);
                       if the user replies unresolved → escalate.
       • "refund"   → Finance queue (human).
       • "other"    → AI node classifies {billing, playback, content, account}
                       + drafts a reply for a human to approve.
  └─ Create a card in your support tool (email / Slack / DB).
  └─ Optionally PATCH the ticket status + push a notification to the user.
```

Only auto-act on safe, reversible cases (a proven double-charge). Everything
else drafts a reply for a human.

## Workflow 2 — `audio-completion-feedback`

Trigger when `audio_progress.completed` flips false→true (a DB trigger writing an
outbox row that n8n polls, or Realtime):

```
Wait 30 min
  └─ Check: not already rated? push consent on?
  └─ Web Push / FCM: "Enjoyed {title}? Tap to rate ⭐" → deep link to /audio/{id}
```

Reuses the existing VAPID web-push + app push plumbing; the rating writes to
`audio_ratings` (already wired in the store).
