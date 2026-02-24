# EPA Compliance Dashboard

Monorepo containing:

- `apps/web`: Vite + React frontend
- `apps/api`: Express + MongoDB backend

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

- `npm run dev:web`
- `npm run dev:api`
- `npm run build`
- `npm run start:api`

## Staging

Staging setup instructions are in [STAGING_SETUP.md](./STAGING_SETUP.md).

Quick commands:

```bash
npm run setup:staging
npm run build:staging
npm run start:staging:api
```

## Security Notes

- Never commit real secrets.
- Use `apps/api/.env.staging.example` and `apps/web/.env.staging.example` as templates.
- Configure Resend via `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_FROM_NAME` in API env.
