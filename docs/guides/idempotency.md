# Idempotency

Idempotency ensures that retrying a request produces the same result, preventing duplicate payments.

## How It Works

1. Include a unique Idempotency-Key header with POST requests
2. The API stores the response for that key
3. Replaying the same key returns the cached response

## Usage

```bash
curl -X POST \
  -H "Idempotency-Key: order-12345-payment" \
  -H "Content-Type: application/json" \
  -d '{"quoteId": "quote_abc", ...}' \
  http://localhost:4000/v1/payments
```

## Best Practices

### Key Format

Use a combination that uniquely identifies the operation:

```
{entity}-{entity_id}-{operation}
```

Examples:
- order-12345-payment
- invoice-abc-refund
- user-xyz-topup-20240113

### Key Lifetime

Keys are valid for 24 hours. After that, a new request with the same key creates a new resource.

### SDK Behavior

The SDK automatically generates idempotency keys for each request:

```typescript
await client.payments.create({ ... }); // key: uuid-1
await client.payments.create({ ... }); // key: uuid-2
```
