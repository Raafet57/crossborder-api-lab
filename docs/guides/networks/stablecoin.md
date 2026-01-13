# Stablecoin Networks

Real blockchain transactions on EVM testnets.

## Supported Chains

| Network ID | Chain | Token | Explorer |
|------------|-------|-------|----------|
| polygon-usdc | Polygon Amoy | USDC | [Polygonscan](https://amoy.polygonscan.com) |
| base-usdc | Base Sepolia | USDC | [Basescan](https://sepolia.basescan.org) |

## Payment Flow

```
CREATED -> QUOTE_LOCKED -> COMPLIANCE_CHECK -> SUBMITTED -> CONFIRMED (3 blocks) -> COMPLETED
```

## Block Confirmations

| Chain | Required Blocks | ~Time |
|-------|-----------------|-------|
| Polygon | 3 | ~6 seconds |
| Base | 3 | ~6 seconds |

## Example

```typescript
const quote = await client.quotes.create({
  networkId: 'polygon-usdc',
  sourceCurrency: 'USD',
  destCurrency: 'USDC',
  amount: 100,
  amountType: 'SOURCE',
});

const payment = await client.payments.create({
  quoteId: quote.id,
  payerId: 'payer_polygon_usdc',
  sender: { firstName: 'John', lastName: 'Doe' },
  receiver: {
    firstName: 'Jane',
    lastName: 'Smith',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  },
});

const confirmed = await client.payments.confirm(payment.id);
console.log('TX Hash:', confirmed.networkPaymentId);
```

## Viewing Transactions

```
https://amoy.polygonscan.com/tx/{networkPaymentId}
```
