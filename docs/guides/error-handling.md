# Error Handling

The API uses standard HTTP status codes and structured error responses.

## Error Response Format

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid currency pair",
  "details": {
    "field": "destCurrency",
    "value": "INVALID"
  }
}
```

## HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Authentication failed |
| 404 | Resource not found |
| 409 | Conflict |
| 429 | Rate limit exceeded |
| 500 | Server error |

## SDK Error Classes

```typescript
import {
  CrossBorderError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
} from '@crossborder/sdk';

try {
  await client.payments.create({ ... });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.details);
  } else if (error instanceof AuthenticationError) {
    console.log('Check your API key');
  } else if (error instanceof NotFoundError) {
    console.log('Quote not found');
  } else if (error instanceof RateLimitError) {
    console.log('Slow down');
  }
}
```
