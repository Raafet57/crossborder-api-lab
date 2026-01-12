# Cross-Border Payments API

A production-grade cross-border payments orchestration layer supporting multiple payment networks.

## Networks

| Type | Implementation |
|------|----------------|
| Stablecoins | Polygon, Base (testnet) |
| Card Networks | Stripe (test mode) |
| Mobile Wallets | M-Pesa, GCash (simulated) |
| Tokenized Assets | RWA (simulated) |

## Architecture

- **Network Adapter Pattern** - Pluggable payment network integrations
- **Event Sourcing** - Immutable payment event streams
- **State Machines** - Network-specific payment flows

## Packages

```
packages/
  core/              # Domain types, events, state machines
  api-gateway/       # REST API service
  network-adapters/  # Network implementations
  webhook-service/   # Webhook handling
  sdk/               # TypeScript SDK
  demo-app/          # CLI demo
```

## Requirements

- Node.js 20+

## Setup

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Test

```bash
npm test
```

## License

MIT
