# Ride hailing — how it works and how to run it

Grab/Bolt-style rides inside Gwave. Not a second app: the passenger side is a
feature of the existing Flutter app and the driver side is a mode within it,
gated on an approved `ride_driver_profiles` row.

## What it does NOT use, and why

| Usual answer | What Gwave does | Why |
|---|---|---|
| ElastiCache Redis for driver geo | `ride_driver_locations` in Postgres | One row per driver, UPSERTed in place at fillfactor 70 (a HOT update). Bounding-box prefilter on a partial index, then haversine. Good for hundreds–low thousands of concurrent drivers; US$13–40/month saved until it isn't. |
| API Gateway WebSocket | The self-hosted Realtime already running | Position updates every 4s are ~900 messages per driver-hour. API Gateway charges per message and per connection-minute; Realtime on the existing EC2 box charges nothing. |
| A dispatcher worker process | The waiting rider's own polling | See `src/lib/ride/dispatch.ts`. The rider is present for exactly as long as dispatch needs to run. `/api/ride/dispatch/tick` sweeps the rest on a one-minute cron. |
| EKS | The existing EC2 box | The control plane alone is US$73/month. |
| Google Directions | OSRM, self-hosted | US$5 per 1,000 calls versus one container. `RIDE_GOOGLE_MAPS_KEY` switches to Google when the address quality is worth paying for. |

The migration path is deliberately short in every row: swapping in Redis means
rewriting `ride_nearest_drivers()` and nothing else.

## Setup

### 1. Schema

```bash
DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
curl -sSL https://raw.githubusercontent.com/KoNyein/gwave.ai/main/db/sql/ride-hailing.sql \
  | sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
      psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com -U gwaveadmin -d gwave
sudo docker restart postgrest
```

Re-running it is safe — every statement is idempotent.

### 2. Routing (OSRM)

One container on the app box. The Myanmar extract is ~150MB and the
preprocessing is a few minutes, once.

```bash
sudo mkdir -p /opt/osrm && cd /opt/osrm
sudo curl -O https://download.geofabrik.de/asia/myanmar-latest.osm.pbf
sudo docker run --rm -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/myanmar-latest.osm.pbf
sudo docker run --rm -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/myanmar-latest.osrm
sudo docker run --rm -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/myanmar-latest.osrm
sudo docker run -d --restart unless-stopped --name osrm \
  -p 127.0.0.1:5000:5000 -v /opt/osrm:/data \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/myanmar-latest.osrm
```

Bound to 127.0.0.1 on purpose — an open OSRM is free routing for anyone who
finds it.

### 3. Runtime env (`/etc/gwave-web.env`)

```
RIDE_OSRM_URL=http://127.0.0.1:5000
RIDE_DISPATCH_SECRET=<openssl rand -hex 32>
# Optional: switches routing to Google, at US$5/1,000 calls.
# RIDE_GOOGLE_MAPS_KEY=
```

Then `sudo gwave-redeploy`. None of these are `NEXT_PUBLIC_*`, so they are read
at runtime and no image rebuild is needed.

### 4. The sweeper

```bash
sudo crontab -e
* * * * * curl -sS -X POST https://gwave.cc/api/ride/dispatch/tick -H "x-dispatch-secret: SECRET" >/dev/null 2>&1
```

Without `RIDE_DISPATCH_SECRET` the route returns 503 rather than defaulting to
open — an unauthenticated endpoint that mutates ride state would let anyone
time out every offer in the system.

### 5. Platform wallet

Wallet rides refuse to settle until the platform has a G-Pay account for the
commission to land in, because the alternative is money vanishing from a system
whose balances are supposed to sum.

```sql
update ride_settings set platform_gpay_account =
  (select id from gpay_accounts where phone = '<platform KPay number>');
```

## The state machine

```
requested ──> accepted ──> arrived ──> in_progress ──> completed
    │             │            │             │
    ├─> expired   └────────────┴─────────────┴──────> cancelled
    └─> cancelled
```

Enforced by a trigger on `rides`, not by the API. A driver skipping `arrived`
and `in_progress` to bill for a trip that never happened is the failure this
prevents, and it has to be prevented somewhere every writer passes through.

`expired` (nobody accepted) is deliberately separate from `cancelled` (someone
chose to stop): merging them hides a supply problem inside a demand statistic.

## Money

- **Wallet ride** — rider → driver (net) and rider → platform (commission), one
  transaction, three real accounts, balances still sum.
- **Cash ride** — no wallet movement. The commission becomes
  `ride_driver_balances.commission_owed`, settled later from the driver's
  wallet. A driver over `max_commission_owed` stops receiving cash offers.
- `ride_settle()` locks the ride row and refuses a second run, so a retried
  request cannot pay twice.
- A settlement failure does **not** fail the completion. The trip happened; the
  ride completes, `payment_status` goes `failed` with the reason, and the
  partial index `rides_unsettled_idx` is support's queue.

## Endpoints

| Route | Who | What |
|---|---|---|
| `POST /api/ride/quote` | rider | Prices all four vehicle types from one route call |
| `POST /api/ride/request` | rider | Books, then rings the first driver before responding |
| `GET /api/ride/active` | either | What am I in the middle of — for app start/resume |
| `GET /api/ride/[id]` | both | One ride; the rider's poll also drives dispatch |
| `POST /api/ride/[id]/status` | driver | arrived / in_progress / completed (+ settle) |
| `POST /api/ride/[id]/cancel` | either | Records who, and the fee |
| `POST /api/ride/[id]/rate` | both | Once each way |
| `POST /api/ride/offers/respond` | driver | accept / decline, race-safe |
| `POST /api/ride/driver/heartbeat` | driver | Position, every few seconds |
| `POST /api/ride/dispatch/tick` | cron | Sweeper |

Realtime channels: `ride:{rideId}` (both parties, plus `driver_position`) and
`ride-driver:{driverId}` (offers).

## Still to build

- Driver signup + document upload, and the admin approval queue.
- Native passenger and driver screens (Phase 3/4).
- Android background location: foreground service, `ACCESS_BACKGROUND_LOCATION`,
  and Play Store prominent disclosure. Getting this wrong gets the app removed,
  so it is its own phase rather than a detail of the driver screen.
- In-trip SOS. Gwave already has SOS with GPS, photo and SMS fallback; wiring
  the existing button into a ride is most of the work.
