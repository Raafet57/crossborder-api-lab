# Tokenized Asset Networks

Mocked implementation demonstrating institutional RWA settlement.

## Network ID

- rwa-tbonds - Treasury Bonds (mocked)

## Payment Flow

```
CREATED -> QUOTE_LOCKED -> COMPLIANCE_CHECK -> QUEUED -> MATCHING -> PENDING_CUSTODY -> SETTLED -> COMPLETED
```

## Settlement Timeline

| Stage | Timeline |
|-------|----------|
| Matching | Same day |
| Custody transfer | T+1 |
| Final settlement | T+1 |

## Example

```typescript
const quote = await client.quotes.create({
  networkId: 'rwa-tbonds',
  sourceCurrency: 'USD',
  destCurrency: 'TBOND',
  amount: 100000,
  amountType: 'SOURCE',
});

const payment = await client.payments.create({
  quoteId: quote.id,
  payerId: 'payer_rwa_tbonds',
  sender: { firstName: 'Acme Corp', lastName: 'Treasury' },
  receiver: { firstName: 'Custody', lastName: 'Account', walletAddress: 'custody_123' },
  purpose: 'INVESTMENT',
});
```

## Compliance Requirements

- Accredited investor verification
- KYC/AML enhanced due diligence
- Large transaction reporting
