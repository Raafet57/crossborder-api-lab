# Idempotency

Idempotency is enforced for:
- `POST /v1/quotations`
- `POST /v1/quotations/:id/transactions`

The client must send:
- `Idempotency-Key: <unique key>`

## Server rules
- Same `Idempotency-Key` + same request fingerprint ⇒ replay the original response
  - `POST /v1/quotations` replays `200` with the same quote `id`
  - `POST /v1/quotations/:id/transactions` replays `201` with the same transaction `id`
- Same `Idempotency-Key` + different request fingerprint ⇒ `409` with `code: "IDEMPOTENCY_CONFLICT"`

All state is in-memory only; restarting the server clears idempotency history.

## How the request fingerprint is computed
The server hashes a normalized snapshot:
- `method`
- `path` (without query string)
- `body`

Algorithm:
1. Build `{ method, path, body }`
2. Normalize JSON by recursively sorting object keys (arrays keep order)
3. `fingerprint = sha256( JSON.stringify(normalizedSnapshot) )` as hex

Implications:
- Changing key order in a JSON object does not change the fingerprint.
- Changing any value (or the request path) changes the fingerprint.

## Examples

### Replay (same key, same body)
```bash
KEY=11111111-1111-1111-1111-111111111111

curl -sS -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":100,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'

curl -sS -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":100,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'
```

### Conflict (same key, different body)
```bash
KEY=22222222-2222-2222-2222-222222222222

curl -sS -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":100,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'

curl -sS -i -H 'Authorization: Bearer demo_key' -H 'Content-Type: application/json' -H \"Idempotency-Key: $KEY\" \\
  http://localhost:4000/v1/quotations \\
  -d '{\"source_amount\":101,\"source_currency\":\"SGD\",\"dest_currency\":\"PHP\",\"payer_id\":\"P1\",\"mode\":\"SOURCE\"}'
```

Expected response: `409` with `code: "IDEMPOTENCY_CONFLICT"`.

