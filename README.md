# crossborder-api-lab

Tiny cross-border payout lab for learning REST, JSON, webhooks, idempotency, auth, error models, reconciliation, and versioning by implementing both sides.

## Requirements
- Node `20.11.0` (see `.nvmrc`)

## Repo layout
- `mock-network-api` (Express + TypeScript mock payout API, port `4000`)
- `webhook-receiver` (Express + TypeScript webhook server, port `4002`)
- `partner-app` (TypeScript CLI that calls the API)
- `docs`, `postman`, `tests`

## Environment (defaults)
- `AUTH_KEY=demo_key`
- `WEBHOOK_URL=http://localhost:4002/webhooks/thunes`
- `WEBHOOK_SECRET=whsec_demo`

## Install
From repo root:
- `npm install`

## Run
In separate terminals:
- Mock API: `npm run dev -w mock-network-api`
- Webhook receiver: `npm run dev -w webhook-receiver`
- Partner CLI (examples):
  - `npm run build -w partner-app`
  - `npm run start -w partner-app -- discover`
  - `npm run start -w partner-app -- quote --src 100 --scur SGD --dcurr PHP --payer P1 --mode SOURCE`

## Test
- `npm test`
