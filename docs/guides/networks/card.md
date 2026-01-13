# Card Networks (Stripe)

Real Stripe test mode integration.

## Network ID

- stripe - Stripe test mode

## Payment Flow

```
CREATED -> QUOTE_LOCKED -> COMPLIANCE_CHECK -> PROCESSING -> [REQUIRES_ACTION] -> CONFIRMED -> SETTLED -> COMPLETED
```

## Test Card Numbers

| Card | Number | Behavior |
|------|--------|----------|
| Visa | 4242424242424242 | Success |
| Visa (3DS) | 4000002500003155 | Requires authentication |
| Declined | 4000000000000002 | Card declined |
| Insufficient | 4000000000009995 | Insufficient funds |

Use any future expiry date and any 3-digit CVC.

## 3D Secure Handling

```typescript
const payment = await client.payments.confirm(paymentId);

if (payment.status === 'PENDING_USER_ACTION') {
  // Redirect user to payment.data.redirectUrl
}
```

## Settlement Timeline

| Stage | Timeline |
|-------|----------|
| Authorization | Immediate |
| Capture | 1-2 days |
| Settlement | 2-7 days |
