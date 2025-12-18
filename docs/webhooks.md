# Webhooks

The mock API emits a signed webhook after confirming a transaction.

## Endpoint
- Receiver URL (default): `http://localhost:4002/webhooks/thunes`
- Sender config: `WEBHOOK_URL`

## Signature
- Header: `X-Sig`
- Algorithm: HMAC SHA256
- Encoding: hex
- Secret: `WEBHOOK_SECRET` (default `whsec_demo`)

The signature is computed over the exact raw request body bytes.

### Compute (Node.js)
```js
import { createHmac } from "crypto";

const secret = process.env.WEBHOOK_SECRET ?? "whsec_demo";
const body = JSON.stringify(event); // exact bytes you send
const sig = createHmac("sha256", secret).update(body).digest("hex");
```

### Verify (Node.js)
```js
import { createHmac, timingSafeEqual } from "crypto";

const secret = process.env.WEBHOOK_SECRET ?? "whsec_demo";
const rawBody = Buffer.from(reqBodyText, "utf8");
const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

const ok =
  typeof sigHeader === "string" &&
  timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"));
```

## Event shape
Example `transaction.updated`:
```json
{
  "id": "8b8f5f9a-5b2f-4b4c-9c9a-1f4d3b2c1a0e",
  "type": "transaction.updated",
  "created_at": "2025-01-01T00:00:00.750Z",
  "data": {
    "transaction": {
      "id": "TX_ID",
      "status": "COMPLETED",
      "rejection_reason": null
    }
  }
}
```

## Retry policy
This lab implementation sends webhooks once (no retries). For production-style behavior, use:
- Retry on network errors, timeouts, and `5xx`
- Do not retry on `2xx`
- Treat `4xx` as non-retryable unless explicitly documented
- Exponential backoff with jitter (example schedule): 1s, 2s, 4s, 8s, 16s (max attempts 5)
- Make the receiver idempotent (dedupe by event id, or by `(type, txId, status)` depending on your model)

