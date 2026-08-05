# GWAVE Home platform — rollout (one-time, prod EC2 box)

The `gwave-home` container (built by `.github/workflows/gwave-home.yml`)
serves the unified IoT platform: device registry + traits + permissions,
embedded MQTT broker for ESP32 nodes, sensor time-series, and the rules
engine. The web UI lives at **gwave.cc/iot** (Next.js proxies
`/api/home/*` → `127.0.0.1:4000` after Cognito session checks).

## 1. Database (run the migrations on RDS)

```bash
DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
# then with the usual dockerised psql against database "gwave":
#   \i gwave-home/db/migrations.sql
#   \i gwave-home/db/migrations_v2.sql
```

## 2. Env (/etc/gwave-web.env)

```
GH_DATABASE_URL=postgres://gwaveadmin:<DBPASS>@<RDS_HOST>:5432/gwave
GH_PROXY_KEY=<openssl rand -hex 16>
GH_MQTT_INTERNAL_PASSWORD=<openssl rand -hex 16>
HOME_API_URL=http://172.17.0.1:4000
```

`GH_PROXY_KEY` + `HOME_API_URL` are read by the web container too — one
env file, both services. After adding: `sudo gwave-redeploy` (web) and
re-run the gwave-home deploy (workflow dispatch) or wait for the next
main push touching `gwave-home/`.

## 3. Security group

Open inbound **TCP 1883** (MQTT for ESP32 nodes). Per-device credentials
(sha256, from /api/provision) + topic ACL protect it; move to TLS 8883
when real deployments grow.

## 4. Verify

```bash
curl -s http://127.0.0.1:4000/health          # {"ok":true,...}
```
Then gwave.cc/iot → site ဆောက် → ➕ ကိရိယာထည့် → credentials ထုတ် →
`node gwave-home/tools/simulator.js` (or a real ESP32 with
`gwave-home/esphome/farm-node.yaml`) → device auto-appears.
