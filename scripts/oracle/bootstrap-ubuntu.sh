#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root: sudo bash scripts/oracle/bootstrap-ubuntu.sh"
  exit 1
fi

echo "==> Updating system packages"
apt-get update -y
apt-get upgrade -y

echo "==> Installing base dependencies"
apt-get install -y ca-certificates curl gnupg lsb-release git nginx ufw

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installing PM2"
npm install -g pm2

echo "==> Installing Certbot for Nginx"
apt-get install -y certbot python3-certbot-nginx

echo "==> Enabling Nginx"
systemctl enable nginx
systemctl restart nginx

echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "==> Installed versions"
node -v
npm -v
pm2 -v
nginx -v

echo ""
echo "VM bootstrap completed."
echo "Next: configure production envs and run scripts/oracle/setup-nginx.sh"
