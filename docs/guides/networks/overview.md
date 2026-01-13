# Payment Networks Overview

The API supports four types of payment networks, each with different characteristics.

## Network Types

| Type | Implementation | Settlement | Use Case |
|------|---------------|------------|----------|
| Stablecoin | Real testnet | ~30 seconds | Crypto-native payments |
| Card | Real test mode | 2-7 days | Traditional card payments |
| Mobile Wallet | Mocked | Instant-24h | Emerging market payments |
| Tokenized Assets | Mocked | T+1 | Institutional settlement |

## Network Discovery

```typescript
const networks = await client.networks.list();
const stablecoins = networks.filter(n => n.type === 'stablecoin');
```

## Available Networks

### Stablecoins
- polygon-usdc - Polygon Amoy USDC (testnet)
- base-usdc - Base Sepolia USDC (testnet)

### Card Networks
- stripe - Stripe test mode

### Mobile Wallets
- mpesa - M-Pesa (mocked)
- gcash - GCash (mocked)

### Tokenized Assets
- rwa-tbonds - Treasury Bonds (mocked)

## Network-Specific Guides

- [Stablecoin Networks](./stablecoin.md)
- [Card Networks](./card.md)
- [Mobile Wallets](./mobile-wallet.md)
- [Tokenized Assets](./tokenized-assets.md)
