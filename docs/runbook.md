# Runbook

## Requirements
- Node `20.11.0` (see `.nvmrc`)

## Run all processes (local)
From repo root:
1. Install deps: `npm install`
2. Start webhook receiver (port `4002`): `npm run dev -w webhook-receiver`
3. Start mock API (port `4000`): `npm run dev -w mock-network-api`

The mock API sends webhooks to:
- `WEBHOOK_URL` (default `http://localhost:4002/webhooks/thunes`)

## Walkthrough (CLI)

Discover payers:
```bash
npm run start -w partner-app -- discover
```

Create a quote:
```bash
npm run start -w partner-app -- quote --src 100 --scur SGD --dcurr PHP --payer P1 --mode SOURCE
```

Create a transaction from a quote:
```bash
npm run start -w partner-app -- create --quote QUOTE_ID --ext EXT123 --sender ./fixtures/sender.json --receiver ./fixtures/receiver.json --purpose "Salary"
```

Confirm and wait for webhook:
```bash
npm run start -w partner-app -- confirm --tx TX_ID
```

Get status:
```bash
npm run start -w partner-app -- status --tx TX_ID
```

## Verify a webhook signature
The receiver validates:
- `X-Sig = HMAC_SHA256_HEX(WEBHOOK_SECRET, raw_body)`

Steps:
1. Capture the exact raw request body bytes (do not re-serialize JSON).
2. Compute `hex(hmac_sha256(secret, raw_body))`.
3. Compare the computed hex to the `X-Sig` header using a constant-time compare.

## Reproduce a 409 idempotency conflict
Use the same `Idempotency-Key` with a different body:
```bash
KEY=33333333-3333-3333-3333-333333333333

curl -sS -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":100,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'

curl -sS -i -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":101,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'
```

## Trigger 429 and back off
Rate limit is 5 requests per second per IP on `/v1/*`.

```bash
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" -H 'Authorization: Bearer demo_key' http://localhost:4000/v1/payers; done

# Inspect headers (including Retry-After) when you hit 429:
curl -s -D - -o /dev/null -H 'Authorization: Bearer demo_key' http://localhost:4000/v1/payers
```

If you receive `429`, wait at least the `Retry-After` seconds before retrying.

## Reconcile a missed webhook
The webhook receiver is in-memory only; restarting it will lose stored events.

To reconcile:
1. Check the source of truth: `GET /v1/transactions/:id` (final status is `COMPLETED` or `REJECTED`)
2. Check whether you received the event: `GET /events/:txId` on the webhook receiver
   - If it returns `404`, the event was missed (or the receiver restarted)
3. Use the transaction `status` + `rejection_reason` (if any) from the API response to complete reconciliation.

## Postman
Import:
- `postman/crossborder.postman_collection.json`
- `postman/crossborder.postman_environment.json`

Then run folders in order: Discover → Quote → Create Transaction → Confirm → Get Status.
