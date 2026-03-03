# EPA Compliance Dashboard

Monorepo containing:

- `apps/web`: Vite + React frontend
- `apps/api`: Express + MongoDB backend

## User Documentation

- Role-based end-to-end user manual: [docs/ROLE_BASED_USER_MANUAL.md](./docs/ROLE_BASED_USER_MANUAL.md)
- Supporting docs pack (cheatsheets, SOPs, FAQ, UAT): [docs/USER_MANUAL_SUPPORT/README.md](./docs/USER_MANUAL_SUPPORT/README.md)

## Deployment

Use the full deployment guide in [ORACLE_DEPLOYMENT.md](./ORACLE_DEPLOYMENT.md). 

Quick commands:

```bash
npm install
npm run setup:production
npm run build:production
npm run deploy:oracle
```
