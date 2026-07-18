# Covo frontend demo

This repository is the isolated UI workspace for collaboration. It contains no backend, credentials, API URL, payment gateway, map provider, or external authentication.

All screens use local demo data. Login and registration create a simulated session; maps, uploads, messages and payments are local simulations.

## Demo credentials

Use either account to sign in. The password is not validated by the local mock, but the form requires at least 10 characters; use `demo123456`.

| Role | Email | Password |
| --- | --- | --- |
| Passenger | `pasajero@demo.local` | `demo123456` |
| Driver | `conductor@demo.local` | `demo123456` |

## Run locally

```bash
npm ci --legacy-peer-deps
npm run dev
```

Or use Docker without a backend:

```bash
docker compose up --build
```

The demo is available at `http://localhost:3002` with Docker.

## Before pushing

```bash
npm run lint
npm test
npm run build
```

You may push to `main`. GitHub Actions runs the same checks. Changes are reviewed and copied manually to the private production repository; this repository never receives production configuration or backend code.
