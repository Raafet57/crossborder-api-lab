# Authentication

The API supports two authentication methods: API keys and Bearer tokens.

## API Key Authentication

Include your API key in the Authorization header:

```bash
curl -H "Authorization: Bearer your_api_key" \
  http://localhost:4000/v1/networks
```

Or use the X-API-Key header:

```bash
curl -H "X-API-Key: your_api_key" \
  http://localhost:4000/v1/networks
```

## Using the SDK

```typescript
const client = new CrossBorderClient({
  apiKey: 'your_api_key',
});
```

## Request Signing (High-Value Transactions)

For transactions over $10,000, include an HMAC signature:

```typescript
import crypto from 'crypto';

const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify(requestBody);
const signaturePayload = `${timestamp}.${body}`;

const signature = crypto
  .createHmac('sha256', signingSecret)
  .update(signaturePayload)
  .digest('hex');

headers['X-Signature'] = `t=${timestamp},v1=${signature}`;
```

## Idempotency

All POST requests require an Idempotency-Key header:

```bash
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  -H "Idempotency-Key: unique-request-id-123" \
  -H "Content-Type: application/json" \
  -d '{"networkId": "polygon-usdc", ...}' \
  http://localhost:4000/v1/quotes
```

The SDK handles this automatically.

## Environment-Specific Keys

| Environment | Key Prefix | Usage |
|-------------|------------|-------|
| Test | test_ | Development and testing |
| Production | live_ | Real transactions |
