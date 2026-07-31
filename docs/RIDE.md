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
| `POST /api/ride/driver/apply` | anyone | Apply to drive / resubmit |
| `GET /api/ride/driver/apply` | driver | My status, balance, today's earnings |
| `GET /api/ride/admin/drivers` | admin | Approval queue |
| `POST /api/ride/admin/drivers` | admin | approve / reject / suspend / reinstate |
| `POST /api/ride/[id]/share` | rider | Mint the public follow link |
| `GET /api/ride/track/[token]` | **public** | Thin trip state for a follower |
| `/ride/track/[token]` | **public** | The follower's page |

Realtime channels: `ride:{rideId}` (both parties, plus `driver_position`) and
`ride-driver:{driverId}` (offers).

## Driver approval

`status` on `ride_driver_profiles` can only be changed by
`POST /api/ride/admin/drivers`. The application route cannot set it at all —
the field is not in its schema and the write omits it — because an approved
driver can carry passengers and collect cash.

Approval refuses to run without all three documents on file (licence, vehicle
photo, registration). The driver-facing form checks the same thing, but a form
can be bypassed and an admin clicking through a queue at speed should not be
the last line of defence.

Losing approval takes the driver out of the dispatch pool immediately rather
than at their next heartbeat, or a suspended driver keeps getting offers until
their app happens to check in.

## Android location and the Play Store

Driver Mode runs geolocator's **foreground service** with a persistent
notification. It deliberately does NOT request `ACCESS_BACKGROUND_LOCATION`.

Background location triggers Play Store's prominent-disclosure review, which is
the most common reason ride apps are rejected or pulled. A foreground service
collects position only while Driver Mode is on and the driver can see that it
is running. The manifest patcher in `build-flutter-apk.yml` adds
`FOREGROUND_SERVICE_LOCATION` (required on Android 14+) and nothing more.

**Do not add the background permission to make a missed offer more reliable.**
Offers also arrive by FCM, which works with the screen off.

## Safety

**SOS** during a trip is the existing Gwave SOS — same `sos_alerts` table, same
map board, same responders — with the ride attached: plate, vehicle, driver
name and destination. A "help me" with no vehicle in it is the version nobody
can act on, and the plate is the first thing anyone will ask for. Both sides
get the button; a driver alone in a car with a stranger is exposed the same way
the passenger is.

**Share my trip** mints an unguessable token (32 random bytes) so the person a
rider sends it to needs no Gwave account — "install our app first" is not an
answer to "I'm worried about you". Only the rider can mint it: a driver able to
publish a link to their passenger's live position and destination would have a
stalking tool, not a safety feature. Minting is idempotent, so sharing with a
second person does not break the first one's link.

The follower's page shows the vehicle, the plate, the driver's **first name**
and the car's position. It does not show the rider's identity, either phone
number, the fare or the payment method. The plate is in precisely because it is
what you would read out to the police; the rest is not the follower's business
and definitely not the business of whoever the link gets forwarded to. Position
publishing stops the moment the trip ends, the link keeps answering for 30
minutes after (so a follower opening it a minute late reads "Arrived safely"
rather than a 404 that looks like something went wrong), and then expires. The
page is `noindex`.

## Still to build

- A web admin page for the approval queue (the API is done; today an admin
  would be calling it by hand).
- Address search. Destinations are set by tapping the map — there is no
  geocoder, so an address box would be a field that does nothing.
- Driver commission settlement from the app (`ride_driver_settle` exists and is
  tested; nothing calls it yet).
