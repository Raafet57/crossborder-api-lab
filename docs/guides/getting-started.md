# Getting Started

This guide walks you through making your first cross-border payment using the API.

## Prerequisites

- Node.js 18+
- npm or yarn
- Running API services (see Local Development below)

## Installation

```bash
npm install @crossborder/sdk
```

## Quick Example

```typescript
import { CrossBorderClient } from '@crossborder/sdk';

const client = new CrossBorderClient({
  apiKey: 'your_api_key',
  baseUrl: 'http://localhost:4000',
});

async function makePayment() {
  // 1. Discover available networks
  const networks = await client.networks.list();
  console.log('Available networks:', networks.map(n => n.name));

  // 2. Create a quote
  const quote = await client.quotes.create({
    networkId: 'polygon-usdc',
    sourceCurrency: 'USD',
    destCurrency: 'USDC',
    amount: 100,
    amountType: 'SOURCE',
  });
  console.log(`Quote: ${quote.sourceAmount} ${quote.sourceCurrency} -> ${quote.destAmount} ${quote.destCurrency}`);

  // 3. Create payment
  const payment = await client.payments.create({
    quoteId: quote.id,
    payerId: 'payer_polygon_usdc',
    sender: { firstName: 'John', lastName: 'Doe' },
    receiver: { firstName: 'Jane', lastName: 'Smith', walletAddress: '0x...' },
  });
  console.log('Payment created:', payment.id);

  // 4. Confirm payment
  const confirmed = await client.payments.confirm(payment.id);
  console.log('Status:', confirmed.status);
}

makePayment();
```

## Local Development

Start the services:

```bash
# Terminal 1: API Gateway
cd packages/api-gateway && npm run dev

# Terminal 2: Webhook Service
cd packages/webhook-service && npm run dev
```

## Next Steps

- [Authentication](./authentication.md) - Learn about API keys and tokens
- [Webhooks](./webhooks.md) - Receive real-time payment updates
- [Network Guides](./networks/overview.md) - Deep dive into each network type
