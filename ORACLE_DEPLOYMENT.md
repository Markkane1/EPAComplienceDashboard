# Oracle Free Tier VM Deployment Guide

This guide targets Ubuntu on Oracle Free Tier and deploys:
- `apps/api` with PM2 on port `8080`
- `apps/web/dist` via Nginx
- reverse proxy for `/api` and static SPA hosting

## 1) Create/prepare the VM

1. Create an Ubuntu VM in Oracle Cloud (Ampere or AMD is fine).
2. Open these ports in Oracle VCN security rules:
   - `22` (SSH)
   - `80` (HTTP)
   - `443` (HTTPS, optional until you have a domain)
3. SSH into the VM:

```bash
ssh ubuntu@<YOUR_VM_PUBLIC_IP>
```

## 2) Clone the project

```bash
sudo mkdir -p /opt
sudo chown -R ubuntu:ubuntu /opt
cd /opt
git clone <YOUR_REPO_URL> EPAComplianceDashboard
cd EPAComplianceDashboard
```

## 3) Install system dependencies (one-time)

```bash
sudo bash scripts/oracle/bootstrap-ubuntu.sh
```

## 4) Create production env files

Run the interactive setup and fill real values (you can use VM public IP instead of a domain):

```bash
npm run setup:production
```

This creates:
- `apps/api/.env`
- `apps/web/.env.production`

If you prefer manual setup, use:
- `apps/api/.env.production.example` as template for `apps/api/.env`
- `apps/web/.env.production.example` as template for `apps/web/.env.production`

When using VM IP without SSL, keep `ENFORCE_HTTPS=false` in `apps/api/.env`.

## 5) Build and start app (PM2)

```bash
npm run deploy:oracle
```

The API process name is `epa-api` and uses `ecosystem.config.cjs`.

## 6) Configure Nginx

No-domain setup (VM IP / any host):

```bash
sudo bash scripts/oracle/setup-nginx.sh
```

Single-domain setup (`app.example.com` serving web + `/api`):

```bash
sudo bash scripts/oracle/setup-nginx.sh app.example.com
```

Two-domain setup (`app.example.com` + `api.example.com`):

```bash
sudo bash scripts/oracle/setup-nginx.sh app.example.com api.example.com
```

## 7) Enable HTTPS (Let's Encrypt)

Skip this step until your domain DNS points to the VM.

After SSL is active, set `ENFORCE_HTTPS=true` in `apps/api/.env` and redeploy.

After DNS is pointed to the VM:

```bash
sudo certbot --nginx -d app.example.com
```

If using separate API domain:

```bash
sudo certbot --nginx -d app.example.com -d api.example.com
```

## 8) Make PM2 survive reboots

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

Run the command PM2 prints (it includes `sudo` and a generated path).

## 9) Update deployments

```bash
cd /opt/EPAComplianceDashboard
git pull
npm run deploy:oracle
sudo systemctl reload nginx
```

## Useful checks

```bash
pm2 status
pm2 logs epa-api
curl -I http://127.0.0.1:8080/health
sudo nginx -t
sudo systemctl status nginx
```
