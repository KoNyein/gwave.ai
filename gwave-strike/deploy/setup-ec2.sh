#!/bin/bash
# One-time EC2 prep for game.gwave.cc (blueprint §5.1). Run as ubuntu.
set -euo pipefail

sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
sudo mkdir -p /var/www/gwave-strike && sudo chown "$USER" /var/www/gwave-strike

echo ">>> Next (manual):"
echo "  1. Route 53: game.gwave.cc A record -> this instance's Elastic IP"
echo "  2. sudo cp deploy/nginx.game.conf /etc/nginx/sites-available/game.gwave.cc"
echo "     sudo ln -s /etc/nginx/sites-available/game.gwave.cc /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  3. sudo certbot --nginx -d game.gwave.cc"
echo "  4. First deploy: push to main (deploy-strike.yml) or run manually per README-strike.md"
