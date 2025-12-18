# API spec (v1)

Mock API base URL (local): `http://localhost:4000`
Webhook receiver base URL (local): `http://localhost:4002`

## Authentication
All `/v1/*` endpoints require:
- `Authorization: Bearer demo_key` (or `AUTH_KEY` env var)

If missing/invalid, the API returns `401` and sets:
- `WWW-Authenticate: Bearer realm="demo"`

## Common headers
- `X-Correlation-Id: <uuid>` (optional request header)
  - If omitted, the server generates one.
  - The server always echoes it in the response header.
- `Content-Type: application/json` for JSON bodies
- `Idempotency-Key: <uuid>` for idempotent POSTs (see `docs/idempotency.md`)

## Errors
Errors use JSON bodies shaped as:
```json
{ "code": "SOME_CODE", "message": "Human readable", "details": {} }
```

### Examples

401 Unauthorized
```http
WWW-Authenticate: Bearer realm="demo"
```
```json
{
  "code": "UNAUTHORIZED",
  "message": "Unauthorized",
  "details": { "expected": "Authorization: Bearer <token>" }
}
```

409 Idempotency conflict
```json
{
  "code": "IDEMPOTENCY_CONFLICT",
  "message": "Idempotency-Key already used with a different request body",
  "details": { "idempotency_key": "..." }
}
```

429 Rate limited
```http
Retry-After: 1
```
```json
{
  "code": "RATE_LIMITED",
  "message": "Too many requests",
  "details": { "limit": 5, "window_ms": 1000 }
}
```

## Endpoints

### GET /health (both services)
Request:
```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4002/health
```

Response `200`:
```json
{ "status": "ok" }
```

### GET /v1/payers
Returns example payers with supported currency pairs, limits, and required fields for transaction creation.

Request:
```bash
curl -sS \
  -H 'Authorization: Bearer demo_key' \
  -H 'X-Correlation-Id: 11111111-1111-1111-1111-111111111111' \
  http://localhost:4000/v1/payers
```

Response `200`:
```json
[
  {
    "id": "P1",
    "country": "PH",
    "currency_pairs": [{ "source_currency": "SGD", "dest_currency": "PHP" }],
    "required_fields": ["sender.first_name", "sender.last_name", "receiver.first_name", "receiver.last_name", "receiver.bank_account"],
    "min_amount": 10,
    "max_amount": 1000
  }
]
```

### POST /v1/quotations
Creates a quote. Requires `Idempotency-Key`.

Body:
```json
{
  "source_amount": 100,
  "source_currency": "SGD",
  "dest_currency": "PHP",
  "payer_id": "P1",
  "mode": "SOURCE"
}
```

Notes:
- `mode: "SOURCE"` means `source_amount` is the amount to pay in `source_currency`.
- `mode: "DEST"` means `source_amount` is treated as the desired destination amount; the server derives the required `source_amount` to satisfy it.

Request:
```bash
curl -sS \
  -H 'Authorization: Bearer demo_key' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 22222222-2222-2222-2222-222222222222' \
  http://localhost:4000/v1/quotations \
  -d '{"source_amount":100,"source_currency":"SGD","dest_currency":"PHP","payer_id":"P1","mode":"SOURCE"}'
```

Response `200`:
```json
{
  "id": "1f0b2b0d-3b5c-4f2a-8b2c-9a0dce1d2a3b",
  "fx_rate": 41.25,
  "fee": 1.5,
  "source_amount": 100,
  "dest_amount": 4050.94,
  "expires_at": "2025-01-01T00:00:00.000Z"
}
```

### POST /v1/quotations/:id/transactions
Creates a transaction from a quote. Requires `Idempotency-Key`.

Body:
```json
{
  "external_id": "EXT123",
  "sender": { "first_name": "Jane", "last_name": "Doe" },
  "receiver": { "first_name": "Juan", "last_name": "Dela Cruz", "bank_account": "1234567890" },
  "purpose": "Salary"
}
```

Rules:
- Validates required fields listed in the payer’s `required_fields` array (dot paths against the request body).
- Quote must exist and not be expired.

Response `201`:
```json
{
  "id": "4c7f4c0e-4b2a-4d74-9f1f-2f66c6ddc9e1",
  "quote_id": "1f0b2b0d-3b5c-4f2a-8b2c-9a0dce1d2a3b",
  "payer_id": "P1",
  "external_id": "EXT123",
  "sender": { "first_name": "Jane", "last_name": "Doe" },
  "receiver": { "first_name": "Juan", "last_name": "Dela Cruz", "bank_account": "1234567890" },
  "purpose": "Salary",
  "status": "PENDING",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

### POST /v1/transactions/:id/confirm
Confirms a transaction and triggers an async webhook update ~500ms later.

Body:
```json
{}
```

Response `200` (immediate snapshot):
```json
{
  "id": "4c7f4c0e-4b2a-4d74-9f1f-2f66c6ddc9e1",
  "status": "CONFIRMED",
  "updated_at": "2025-01-01T00:00:00.500Z"
}
```

Webhook:
- Sent to `WEBHOOK_URL` (default `http://localhost:4002/webhooks/thunes`)
- Signed with `WEBHOOK_SECRET` (default `whsec_demo`)
- Event `type` is `transaction.updated`
- Final status becomes `COMPLETED` or `REJECTED` (10% chance)

See `docs/webhooks.md`.

### GET /v1/transactions/:id
Returns the latest transaction snapshot.

Response `200`:
```json
{
  "id": "4c7f4c0e-4b2a-4d74-9f1f-2f66c6ddc9e1",
  "status": "COMPLETED",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.750Z"
}
```

## Webhook receiver endpoints

### POST /webhooks/thunes
Receives signed webhook events. Uses a raw body parser; signature is computed over the raw bytes.

Headers:
- `X-Sig: <hex hmac sha256>`
- `Content-Type: application/json`

Request:
```bash
BODY='{"id":"evt_1","type":"transaction.updated","created_at":"2025-01-01T00:00:00.750Z","data":{"transaction":{"id":"TX_ID","status":"COMPLETED"}}}'
SIG=$(node -e "const {createHmac}=require('crypto'); console.log(createHmac('sha256','whsec_demo').update(process.argv[1]).digest('hex'))" "$BODY")

curl -sS -X POST http://localhost:4002/webhooks/thunes \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -d "$BODY"
```

Response `200`:
```json
{ "status": "ok" }
```

Invalid signature response `400`:
```json
{ "code": "BAD_SIGNATURE" }
```

### GET /events/:txId
Returns the latest stored event for a transaction id.

Request:
```bash
curl -sS http://localhost:4002/events/TX_ID
```

Response `200`:
```json
{
  "id": "evt_1",
  "type": "transaction.updated",
  "created_at": "2025-01-01T00:00:00.750Z",
  "data": { "transaction": { "id": "TX_ID", "status": "COMPLETED" } }
}
```

Response `404`:
```json
{ "code": "NOT_FOUND" }
```
