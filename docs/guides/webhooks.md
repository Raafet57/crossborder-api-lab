# Webhooks

Receive real-time notifications when payment status changes.

## Creating a Subscription

```typescript
const subscription = await client.webhooks.create({
  url: 'https://your-app.com/webhooks',
  events: ['payment.completed', 'payment.failed'],
});

// Save the secret for signature verification
console.log('Secret:', subscription.secret);
```

## Available Events

| Event | Description |
|-------|-------------|
| payment.created | Payment created |
| payment.submitted | Submitted to network |
| payment.confirmed | Network confirmed |
| payment.completed | Successfully completed |
| payment.failed | Payment failed |
| payment.cancelled | Payment cancelled |
| * | All events |

## Webhook Payload

```json
{
  "id": "evt_123",
  "type": "payment.completed",
  "timestamp": "2024-01-13T10:30:00Z",
  "data": {
    "paymentId": "pay_abc",
    "status": "COMPLETED",
    "networkPaymentId": "0xabc..."
  }
}
```

## Signature Verification

Every webhook includes a signature header:

```
X-Webhook-Signature: t=1705142400,v1=abc123...
```

Verify it:

```typescript
import { CrossBorderClient } from '@crossborder/sdk';

app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = CrossBorderClient.verifyWebhookSignature(
    req.rawBody,
    signature,
    webhookSecret
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  console.log('Received:', event.type);

  res.json({ received: true });
});
```

## Retry Behavior

Failed deliveries are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 second |
| 3 | 2 seconds |
| 4 | 4 seconds |
| 5 | 8 seconds |
| 6 | 16 seconds |
