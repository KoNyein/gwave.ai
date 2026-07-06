# Phase 6 — Smart Farm + Smart Home (IoT)

Adds the MQTT-based IoT stack: an EMQX broker + Node bridge service, device
registration with per-device credentials, a realtime farm dashboard with
history charts, an automation rules engine with alerts, and a smart home
page with switches, scenes and schedules.

## Architecture

```
device ──MQTT──▶ EMQX ──▶ iot-bridge (service role) ──▶ Supabase
  ▲                │            │  telemetry → sensor_readings
  └── <topic>/cmd ◀┘            │  state     → devices.state
                                │  rules     → device_commands + alerts
web app ──insert──▶ device_commands ──realtime──▶ bridge ──▶ MQTT cmd
web app ◀──realtime── sensor_readings / devices / alerts
```

Topics per device: `<topic>/telemetry`, `<topic>/state` (published by the
device, each message carrying the device `secret`), `<topic>/cmd`
(subscribed). The bridge validates secrets, marks devices online/offline
(90 s silence), evaluates rules and runs scene schedules every minute.

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705170000_iot.sql`:
  - Enums: `device_type`, `device_protocol`, `alert_severity`,
    `command_status`; `notification_type` gains `device_alert`.
  - `devices` (owner, type, zone, unique MQTT topic, per-device secret,
    `state jsonb`, online/last_seen), `sensor_readings` (append-only,
    **BRIN index on ts** + btree on device/metric/ts),
    `automation_rules` (IF device.metric ⋛ threshold THEN command /
    alert, optional time window incl. overnight, severity, cooldown),
    `alerts` (trigger → in-app notification via SECURITY DEFINER),
    `scenes` + `scene_schedules` (time + ISO weekdays), and
    `device_commands` — the command queue between the web app and the
    bridge (`pending → sent → acked`).
  - `latest_sensor_readings()` RPC (SECURITY INVOKER — RLS applies) for
    the dashboard's current values.
  - Realtime publication for `sensor_readings`, `devices`,
    `device_commands`, `alerts`.
  - **RLS**: everything owner-scoped. Users cannot write telemetry or
    alerts (bridge/service-role only) and can queue commands only for
    their own devices; rule `with check` verifies both trigger and
    action devices belong to the owner.

### Services

- **`services/iot-bridge/`** (Node 20 + `mqtt` + `supabase-js`, own
  Dockerfile + README with Coolify deployment steps): telemetry ingest
  with secret validation, state mirroring (confirms UI toggles and acks
  in-flight commands), rule evaluation (comparator, time window,
  cooldown → queue action command + insert alert), realtime + polling
  command dispatch, per-minute scene scheduler, offline sweep.
- **docker-compose**: `emqx` (EMQX 5, anonymous only for local dev) and
  `iot-bridge` services added.
- **`scripts/simulate-devices.mjs`**: publishes drifting fake telemetry
  (pH, EC, VPD, air/water temp, humidity) and echoes `cmd → state` for
  switches, so everything works without hardware.

### Features

1. **`/farm` dashboard** — sensors grouped by zone with per-metric
   cards (current value + inline SVG sparkline), **live updates** via a
   realtime subscription on `sensor_readings`; clicking a metric opens
   a recharts history dialog with 24h/7d/30d ranges served by
   `GET /api/farm/readings` (server-side time-bucketed averages).
2. **Device management** (`/farm/devices`) — register wizard (name,
   type, zone) that generates the MQTT topic + secret and shows them
   **exactly once** with copy-to-clipboard and topic instructions;
   online/offline indicators, edit (name/zone), delete.
3. **Automation rules** (`/farm/rules`) — builder dialog: IF
   [sensor].[metric] is above/below [threshold] THEN [switch] ON/OFF
   (or alert only), optional time window, severity; list with enable
   toggle, last-triggered time and delete. **Alerts** appear below with
   severity chips and acknowledge, and land in the notification bell
   (`device_alert`).
4. **`/home` smart home** — switch cards grouped by zone with
   **optimistic toggles confirmed by the device's state echo** (spinner
   until the realtime `devices` update arrives, revert on failure);
   **scenes** (tap-to-cycle device picker: not included → ON → OFF, run
   now, delete) and **schedules** (time + weekday picker, executed by
   the bridge).
5. `/home` added to the protected routes and the sidebar ("Smart
   home"); `/farm` has a Dashboard / Devices / Rules sub-nav.

## Quality gates

```bash
pnpm typecheck   # OK
pnpm lint        # no warnings or errors
pnpm build       # compiled successfully (/farm, /farm/devices, /farm/rules, /home)
```

Migration chain (0001 → 0007) applied to a scratch PostgreSQL 16
instance with asserts: users cannot insert telemetry directly, strangers
see no foreign devices/readings and cannot queue commands, service-role
alert insert produces a `device_alert` notification, and
`latest_sensor_readings()` is owner-scoped.

## How to test manually (no hardware needed)

1. Apply the migration. Start the stack: `docker compose up emqx iot-bridge`
   (bridge needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
2. In the app: `/farm/devices` → register a **sensor** and a **switch**;
   copy each credentials JSON.
3. Put both into a `devices.json`
   (`[{"id":"...","secret":"...","kind":"sensor"}, {...,"kind":"switch"}]`)
   and run `node scripts/simulate-devices.mjs devices.json`.
4. `/farm` — cards fill in and tick every 5 s; click a metric for the
   24h chart; devices show online.
5. `/farm/rules` — create "IF air temp is above 20 THEN Fan ON": within
   seconds an alert appears (bell rings) and the fan switch flips on in
   `/home` (simulator echoes the state).
6. `/home` — toggle the switch: spinner until the state echo confirms
   (~0.5 s); create a scene with both states and run it; add a schedule
   one minute ahead and watch it fire.

## Notes / follow-ups

- Local EMQX allows anonymous connections for development; production
  hardening (broker users, TLS 8883, disabling anonymous) is documented
  in `services/iot-bridge/README.md` and remains a Phase 9 checklist
  item alongside monthly partitioning if telemetry volume outgrows the
  BRIN setup.
- Device secrets are stored on the owner-only `devices` row; rotating
  them means re-registering (rotation UI is a follow-up).
- Camera devices are registrable but have no stream UI yet.
- POS is Phase 7.
