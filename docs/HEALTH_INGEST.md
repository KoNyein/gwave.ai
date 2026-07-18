# Health ingest API — phone-bridge contract

The companion mobile app (Android **Health Connect** / iOS **HealthKit**) reads
the phone's own health store and pushes it here. The server side is done; this
doc is the contract the future mobile app builds against.

## Endpoint

```
POST https://gwave.cc/api/health/ingest
Content-Type: application/json
Authorization: Bearer <data token>
```

- **Auth**: the app signs the user in through the app's Cognito flow and holds
  the resulting **data token** (the same short-lived ES256 JWT the web keeps in
  the `gw_at` cookie). Send it as a Bearer token. Refresh it the same way the
  web session does (Cognito refresh token → new data token).
- The PWA itself may also call this endpoint with its session cookie (no
  header needed).

## Body

```json
{
  "source": "health_connect",
  "metrics": [
    { "metric_type": "steps",      "value": 8214, "unit": "count", "recorded_at": "2026-07-18T23:59:59Z" },
    { "metric_type": "heart_rate", "value": 72,   "unit": "bpm",   "recorded_at": "2026-07-18T23:59:59Z" },
    { "metric_type": "sleep",      "value": 412,  "unit": "min",   "recorded_at": "2026-07-18T23:59:59Z" }
  ]
}
```

- `source`: `healthkit` | `health_connect` | `phone` | `manual`
- `metric_type`: `steps` | `heart_rate` | `resting_hr` | `sleep` | `calories` | `active_minutes`
- `value`: number ≥ 0 (sleep in **minutes**, active_minutes in **minutes**)
- `recorded_at`: ISO 8601 with offset. For daily totals use end-of-day; the
  server buckets by its date part.
- Max **500** metrics per request. Future-dated timestamps (>1 day ahead) are
  dropped.

## Semantics

- **Idempotent**: rows upsert on `(user, metric_type, recorded_at)` — resending
  a batch (retry, offline replay) updates rather than duplicates. Daily totals
  are cumulative: send the day's latest total with the same `recorded_at`
  (end-of-day) and it overwrites.
- The per-day dashboard summary is recomputed for every day the batch touches.
- Response: `{ "ok": true, "inserted": n, "days": ["2026-07-18"] }`;
  `401` bad/missing auth, `400` bad payload, `500` store failure (safe to retry).

## Recommended app behaviour

Batch since-last-sync data, POST when online, mark synced only on `ok: true`.
Daily totals per day per metric are enough — no need to stream every sample.
