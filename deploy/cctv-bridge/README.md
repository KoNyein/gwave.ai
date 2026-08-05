# Camera Bridge — server rollout (one-time, on the prod EC2 box)

The Camera Bridge lets the Gwave Android app relay a local camera's RTSP
stream OUT to this server, which republishes it as HLS. It exists for
router-less / CGNAT cameras (WiFi camera on a phone hotspot, carrier NAT,
no port-forwarding possible): the server can never dial the camera, so the
phone dials out instead.

```
Tapo cam ──RTSP──▶ Gwave app (same WiFi) ──RTSP publish──▶ MediaMTX :8554
                                                              │
        browser/app ◀──HLS── Caddy /hls/* ◀── 127.0.0.1:8888 ─┘
```

Publish auth: MediaMTX asks `POST /api/cctv/bridge/auth` on the local web
container for every publish. The password is an HMAC token minted by
`POST /api/mobile/cctv/bridge` (signed with `CAMERA_VENDOR_TOKEN_KEY_V1`,
24 h expiry, path-scoped). No camera or user credential ever reaches the
server.

## 1. Run MediaMTX (docker, host networking)

```bash
sudo mkdir -p /opt/cctv-bridge
sudo cp deploy/cctv-bridge/mediamtx.yml /opt/cctv-bridge/mediamtx.yml
sudo docker run -d --name cctv-bridge --restart unless-stopped \
  --network host \
  -v /opt/cctv-bridge/mediamtx.yml:/mediamtx.yml:ro \
  bluenviron/mediamtx:latest
sudo docker logs cctv-bridge --tail 5   # expect "listener opened on :8554"
```

(Host networking so the auth webhook can reach the web container at
`127.0.0.1:3000` and HLS stays loopback-only behind Caddy.)

## 2. Caddy: expose HLS at https://gwave.cc/hls/*

In `/etc/caddy/Caddyfile`, inside the `gwave.cc { … }` site block (next to
the existing `handle_path /mv/*`), add:

```
	handle_path /hls/* {
		reverse_proxy 127.0.0.1:8888
	}
```

Then `sudo systemctl reload caddy`.

## 3. Security group

Open inbound **TCP 8554** (RTSP publish) on the EC2 security group. 8888
stays closed — it is loopback-only.

## 4. Web env

Append to `/etc/gwave-web.env` (requires `CAMERA_VENDOR_TOKEN_KEY_V1`
already set):

```
CCTV_BRIDGE_PUBLISH_BASE=rtsp://gwave.cc:8554
CCTV_BRIDGE_HLS_BASE=https://gwave.cc/hls
```

Then `sudo gwave-redeploy`. Until these are set, the bridge API answers 503
and nothing else changes.

## 5. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"user":"x","password":"y","action":"publish","path":"bridge/cam_0"}' \
  http://127.0.0.1:3000/api/cctv/bridge/auth        # expect 401 (deny works)
curl -s -o /dev/null -w '%{http_code}\n' https://gwave.cc/hls/   # 404 from MediaMTX, not Caddy's 502
```

Then in the app: CCTV → Camera Bridge → fill the camera's IP/account →
Start. The camera tile on gwave.cc/cameras goes live within ~10 s.

## Known limits

- The phone must stay on, on the camera's WiFi, with Gwave open (the screen
  is kept awake). It is a bridge, not a cloud recorder.
- H.265/HEVC cameras: browsers mostly can't play HEVC HLS — set the camera
  to H.264 in its app, or use the SD stream (`stream2`, H.264 on Tapo).
- Tapo audio is G.711 which HLS drops; video plays, audio may be silent.
