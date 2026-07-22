# gwave.ai IoT bridge

Relays MQTT device traffic into the gwave data API (self-hosted PostgREST +
Realtime over RDS — not Supabase) and back:

- `gwave/<device_id>/telemetry` → `sensor_readings` (+ rule evaluation,
  alerts, command fan-out)
- `gwave/<device_id>/state` → `devices.state` (confirms UI toggles)
- `device_commands` (pending) → published to `gwave/<device_id>/cmd`
- scene schedules run once per minute; devices go offline after 90 s of
  silence

Every message must include the device `secret` issued at registration:

```json
{ "secret": "...", "metrics": { "ph": 6.1, "ec": 1.65 } }   // telemetry
{ "secret": "...", "state": { "power": "on" } }             // state
```

## Local development

```bash
# 1. Start the broker + bridge (from the repo root)
docker compose up emqx iot-bridge

# 2. Register a device in the app (/farm/devices) and copy its
#    topic + secret into scripts/simulate-devices.mjs, then:
node scripts/simulate-devices.mjs
```

## Coolify deployment

1. **EMQX**: add a new service from the `emqx/emqx:5` image. Expose 1883
   (MQTT) and 8883 (MQTT/TLS — attach a certificate). Disable anonymous
   access in production (Dashboard → Access Control) and create a user
   for the bridge.
2. **Bridge**: add this directory as a Dockerfile app. Set env:
   `DATA_API_URL`, `DATA_API_SERVICE_KEY` (the old `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` names still work as a fallback),
   `MQTT_URL=mqtt://<emqx-host>:1883`, `MQTT_USERNAME`, `MQTT_PASSWORD`,
   `TZ` (for schedule/rule time windows). No ports needed.
3. Point devices at the broker with their per-device topic + secret.
