# Staging Setup

This guide prepares the monorepo for a staging deployment.

## 1) Install dependencies

```bash
npm install
```

## 2) Configure staging environment files

Option A: interactive setup

```bash
npm run setup:staging
```

Option B: manual setup

```bash
cp apps/api/.env.staging.example apps/api/.env
cp apps/web/.env.staging.example apps/web/.env.staging
```

Then update these required values:

- `apps/api/.env`:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `ADMIN_PASSWORD`
  - `CORS_ORIGIN`
  - `PUBLIC_BASE_URL`
  - `APP_BASE_URL`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- `apps/web/.env.staging`:
  - `VITE_API_URL`

## 3) Build web for staging

```bash
npm run build:staging
```

## 4) Start API in staging

```bash
npm run start:staging:api
```

## 5) Serve web build

Serve `apps/web/dist` from your reverse proxy or static host.
For quick local verification:

```bash
npm run preview:staging:web
```

## Notes

- Staging uses `NODE_ENV=production` in API env to keep production-grade security checks enabled.
- `apps/api/.env` and `apps/web/.env.staging` are gitignored and should not be committed.
- For Resend in non-test environments, use a verified sender domain instead of `onboarding@resend.dev`.
- `setup-staging-env.sh` is also available for Linux shell environments if you prefer bash-based setup.
