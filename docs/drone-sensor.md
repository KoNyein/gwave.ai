# Networked drone detection — SDR sensor setup

A phone can only hear Wi-Fi and Bluetooth, so it cannot see DJI **OcuSync**
(Avata, Mavic, Mini 3/4, DJI FPV) or RC links like **ExpressLRS**, **TBS
Crossfire**, **FrSky** — those hop across 900 MHz / 2.4 GHz with proprietary
modulation. To catch them you connect an external **SDR receiver** (or a
dedicated counter-UAS RF detector) to a small server, decode the signals there,
and POST the detections to Gwave. Every app then plots them on the radar/map.

This is the same idea as the fixed RF-sensor networks used for airspace
awareness — the sensor does the RF heavy lifting, the cloud fans it out.

## 1. Create the table (once)

Run `supabase/sql-editor-bundles/drone-detections.sql` on RDS, then
`sudo docker restart postgrest`.

## 2. Set the sensor key (once)

Add a shared secret to the server runtime env (`/etc/gwave-web.env`) and
redeploy:

```
DRONE_SENSOR_KEY=<a long random string>
```

Then `sudo gwave-redeploy`.

## 3. Run a sensor that decodes RF and POSTs detections

Any device that can decode drone RF and speak HTTP works — a Raspberry Pi with
an RTL-SDR/HackRF, or a commercial RF detector with a scripting hook. Examples of
decoders:

- **OpenDroneID / Remote ID** over Wi-Fi/BLE — `sdrangel`, or the OpenDroneID
  receiver tools.
- **DJI DroneID** (OcuSync) — community decoders such as `dji-droneid` running
  on a HackRF/USRP.
- **ELRS / Crossfire / FrSky presence** — an energy/FHSS detector on 900 MHz /
  2.4 GHz (presence + RSSI, not full telemetry).

Whatever the decoder, wrap its output and POST to the ingest endpoint. One
detection or an array:

```bash
curl -X POST https://gwave.cc/api/drone/report \
  -H "content-type: application/json" \
  -H "x-sensor-key: $DRONE_SENSOR_KEY" \
  -d '[
    {
      "source": "sdr",
      "sensorId": "roof-01",
      "protocol": "OcuSync 3",
      "vendor": "DJI",
      "label": "DJI Avata",
      "rssi": -63,
      "lat": 16.805,
      "lng": 96.155,
      "altitudeM": 45,
      "remoteId": "OP-12345",
      "ttlSeconds": 60
    }
  ]'
```

### Field reference

| field | notes |
|-------|-------|
| `source` | `sdr` \| `sensor` \| `remoteid` \| `wifi` \| `ble` (default `sensor`) |
| `sensorId` | which sensor reported it |
| `protocol` | `OcuSync 3`, `ELRS`, `Crossfire`, `Remote ID`, `Wi-Fi`… |
| `vendor` / `label` | maker + display name |
| `rssi` | signal strength, dBm (−120…0) |
| `lat` / `lng` / `altitudeM` | position when the decoder recovers it |
| `headingDeg` / `speedMs` | optional track |
| `remoteId` | operator / serial when broadcast |
| `detectedAt` | ISO time; defaults to now |
| `ttlSeconds` | how long the detection stays live (10…3600, default 300) |

## 4. The app reads it back

The app calls `GET /api/mobile/drone/nearby?lat=..&lng=..&radius=8000` and plots
the returned detections on the Drone radar / map alongside its own Wi-Fi/BLE
hits. Rows auto-expire (`expires_at`), so the feed always reflects "right now".

## Security notes

- Only holders of `DRONE_SENSOR_KEY` can write; rotate it if leaked.
- The table has no RLS insert policy — writes only happen through this API with
  the service role. Signed-in users can read the live (non-expired) feed.
- Detections are environmental RF data, not user PII.
