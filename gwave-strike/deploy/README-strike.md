# game.gwave.cc — user-side deployment runbook (Phase 4)

The GitHub workflow (`deploy-strike.yml`) builds on every push touching
`gwave-strike/` and deploys automatically **once these one-time steps are
done**. Until then it is build-only (safe).

## 1. DNS
Route 53 → hosted zone gwave.cc → create **A record `game.gwave.cc`** →
the EC2 Elastic IP (same instance as gwave.cc is fine — port 2567 stays
internal behind Nginx).

## 2. EC2 prep (SSH in, run once)
```bash
cd /path/to/repo/gwave-strike
bash deploy/setup-ec2.sh
sudo cp deploy/nginx.game.conf /etc/nginx/sites-available/game.gwave.cc
sudo ln -s /etc/nginx/sites-available/game.gwave.cc /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d game.gwave.cc
```

## 3. GitHub secrets (repo → Settings → Secrets and variables → Actions)
- `STRIKE_EC2_HOST` — the instance's public IP / hostname
- `STRIKE_EC2_SSH_KEY` — a private key whose public half is in
  `~ubuntu/.ssh/authorized_keys` on the instance

## 4. First deploy
Actions → **Deploy GWAVE STRIKE** → Run workflow (or push anything under
`gwave-strike/`). Health check: `https://game.gwave.cc/health` →
`{"ok":true,...}`.

## CDN (optional, §5.4)
```bash
aws s3 mb s3://gwave-strike-assets
aws s3 sync gwave-strike/client/dist/assets s3://gwave-strike-assets/assets \
  --cache-control "public,max-age=31536000,immutable"
```
CloudFront distribution over that bucket (alt domain cdn.gwave.cc) and build
the client with `VITE_ASSET_BASE=https://cdn.gwave.cc` once heavy GLBs land.
