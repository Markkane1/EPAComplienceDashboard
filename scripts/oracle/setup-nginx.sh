#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root: sudo bash scripts/oracle/setup-nginx.sh [web-host] [api-host] [app-root]"
  exit 1
fi

WEB_DOMAIN="${1:-}"
API_DOMAIN="${2:-}"
APP_ROOT="${3:-}"

if [[ -z "$WEB_DOMAIN" ]]; then
  WEB_DOMAIN="_"
fi

if [[ -z "$API_DOMAIN" ]]; then
  API_DOMAIN="$WEB_DOMAIN"
fi

if [[ -z "$APP_ROOT" ]]; then
  APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

WEB_DIST="$APP_ROOT/apps/web/dist"
UPLOADS_DIR="$APP_ROOT/apps/api/uploads"
NGINX_CONF="/etc/nginx/sites-available/epa-compliance-dashboard.conf"

if [[ ! -d "$WEB_DIST" ]]; then
  echo "Web dist directory not found: $WEB_DIST"
  echo "Run deployment first to build frontend."
  exit 1
fi

mkdir -p "$UPLOADS_DIR"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $WEB_DOMAIN;

    root $WEB_DIST;
    index index.html;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8080/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        alias $UPLOADS_DIR/;
        try_files \$uri =404;
        autoindex off;
        add_header Cache-Control "public, max-age=604800";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

if [[ "$API_DOMAIN" != "$WEB_DOMAIN" ]]; then
cat >> "$NGINX_CONF" <<EOF

server {
    listen 80;
    server_name $API_DOMAIN;

    client_max_body_size 10m;

    location /uploads/ {
        alias $UPLOADS_DIR/;
        try_files \$uri =404;
        autoindex off;
        add_header Cache-Control "public, max-age=604800";
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
fi

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/epa-compliance-dashboard.conf
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo ""
echo "Nginx configured for:"
echo "  web host: $WEB_DOMAIN"
echo "  api host: $API_DOMAIN"
echo ""
echo "Optional SSL setup with Certbot:"
if [[ "$WEB_DOMAIN" == "_" ]]; then
  echo "  Skipped: configure DNS first, then run certbot with your domain."
elif [[ "$API_DOMAIN" == "$WEB_DOMAIN" ]]; then
  echo "  sudo certbot --nginx -d $WEB_DOMAIN"
else
  echo "  sudo certbot --nginx -d $WEB_DOMAIN -d $API_DOMAIN"
fi
