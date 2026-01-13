# Mobile Wallet Networks

Mocked implementations demonstrating M-Pesa and GCash flows.

## Network IDs

- mpesa - M-Pesa (Kenya, Tanzania)
- gcash - GCash (Philippines)

## Payment Flow

```
CREATED -> QUOTE_LOCKED -> COMPLIANCE_CHECK -> SUBMITTED -> PENDING_USER_ACTION -> CONFIRMED -> COMPLETED
```

## M-Pesa Flow

M-Pesa uses STK Push - a prompt sent to the user's phone:

1. Payment submitted to M-Pesa
2. User receives prompt on their phone
3. User enters PIN to confirm
4. Payment confirmed via callback

```typescript
const payment = await client.payments.create({
  quoteId: quote.id,
  payerId: 'payer_mpesa_ke',
  sender: { firstName: 'John', lastName: 'Doe' },
  receiver: {
    firstName: 'James',
    lastName: 'Kamau',
    phone: '+254700123456',
  },
});
```

## Timeout Handling

| Network | Timeout |
|---------|---------|
| M-Pesa | 60 seconds |
| GCash | 5 minutes |
