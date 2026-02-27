#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"
WEB_ENV_FILE="$ROOT_DIR/apps/web/.env.production"

if [[ ! -f "$API_ENV_FILE" ]]; then
  echo "Missing $API_ENV_FILE"
  echo "Run: npm run setup:production"
  exit 1
fi

if [[ ! -f "$WEB_ENV_FILE" ]]; then
  echo "Missing $WEB_ENV_FILE"
  echo "Run: npm run setup:production"
  exit 1
fi

echo "==> Installing dependencies"
cd "$ROOT_DIR"
npm ci

echo "==> Building frontend (production mode)"
npm run build:production

echo "==> Preparing upload directories"
mkdir -p "$ROOT_DIR/apps/api/uploads"
mkdir -p "$ROOT_DIR/apps/secure-uploads"

if command -v pm2 >/dev/null 2>&1; then
  echo "==> Starting/reloading API with PM2"
  pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --env production
  pm2 save
else
  echo "PM2 is not installed. Install it first: npm install -g pm2"
  exit 1
fi

echo "==> Deployment complete"
pm2 status
