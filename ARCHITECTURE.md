# Cross-Border Payments API - Architecture

A production-grade payment orchestration platform connecting multiple payment networks through a unified REST API.

## Table of Contents

- [Overview](#overview)
- [Package Structure](#package-structure)
- [Dependency Graph](#dependency-graph)
- [Core Domain](#core-domain)
- [Payment Flow](#payment-flow)
- [Network Adapters](#network-adapters)
- [State Machine](#state-machine)
- [Event Sourcing](#event-sourcing)
- [API Gateway](#api-gateway)
- [Webhook Service](#webhook-service)
- [Security](#security)
- [Data Stores](#data-stores)
- [File Reference](#file-reference)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Applications                         │
│                    (SDK, Postman, Demo App, etc.)                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    API Gateway (:4000)   │
                    │  • REST endpoints        │
                    │  • Auth & rate limiting  │
                    │  • Payment orchestration │
                    │  • Compliance checks     │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Network        │   │  Network        │   │  Webhook        │
│  Adapters       │   │  Adapters       │   │  Service        │
│  (Stripe)       │   │  (Polygon)      │   │  (:4002)        │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         ▼                     ▼                     ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │  Stripe │          │ Polygon │          │  Client │
    │   API   │          │   RPC   │          │Webhooks │
    └─────────┘          └─────────┘          └─────────┘
```

**Tech Stack:**
- Node.js 20.x + TypeScript 5.x (strict mode)
- Express.js for REST APIs
- ethers.js v6 for blockchain
- Stripe SDK for card payments

---

## Package Structure

```
packages/
├── core/                    # Domain logic (no external dependencies)
│   ├── src/types/           # Payment, Quote, Network types
│   ├── src/domain/          # State machine, events, event store
│   └── src/utils/           # Crypto, idempotency, correlation
│
├── api-gateway/             # REST API (port 4000)
│   ├── src/routes/v1/       # Endpoints: networks, quotes, payments
│   ├── src/middleware/      # Auth, rate limit, audit log
│   ├── src/services/        # Orchestrator, compliance, quote
│   └── src/stores/          # Payment & quote storage
│
├── network-adapters/        # Payment network integrations
│   ├── src/interface.ts     # NetworkAdapter interface
│   ├── src/factory.ts       # Adapter factory & configs
│   └── src/adapters/        # Stripe, Polygon, M-Pesa, GCash, RWA
│
├── webhook-service/         # Webhook handling (port 4002)
│   ├── src/handlers/        # Stripe, M-Pesa inbound handlers
│   ├── src/dispatcher/      # Outbound webhook delivery
│   └── src/routes/          # Inbound & subscription routes
│
├── sdk/                     # TypeScript client SDK
│   ├── src/client.ts        # CrossBorderClient class
│   └── src/resources/       # Networks, Quotes, Payments resources
│
└── demo-app/                # Interactive CLI demo
    ├── src/interactive.ts   # Step-by-step payment flow
    └── src/scenarios.ts     # Predefined test scenarios
```

---

## Dependency Graph

```
                    ┌──────────┐
                    │   sdk    │ (no internal deps)
                    └──────────┘

┌──────────┐       ┌──────────────┐       ┌─────────────────┐
│ demo-app │──────▶│     sdk      │──────▶│  (HTTP/fetch)   │
└──────────┘       └──────────────┘       └─────────────────┘

┌──────────────┐   ┌──────────────────┐   ┌──────────┐
│ api-gateway  │──▶│ network-adapters │──▶│   core   │
└──────────────┘   └──────────────────┘   └──────────┘
        │                                       ▲
        └───────────────────────────────────────┘

┌─────────────────┐
│ webhook-service │──────────────────────▶ core
└─────────────────┘
```

**External Dependencies:**
- `api-gateway`: express, uuid
- `network-adapters`: ethers, stripe
- `webhook-service`: express, uuid
- `sdk`: none (fetch API)
- `demo-app`: @inquirer/prompts, chalk, ora

---

## Core Domain

### Types (`packages/core/src/types/index.ts`)

```typescript
// Payment status throughout lifecycle
type PaymentStatus =
  | 'CREATED'           // Initial state
  | 'QUOTE_LOCKED'      // FX rate locked
  | 'COMPLIANCE_CHECK'  // Running AML/sanctions
  | 'PENDING_NETWORK'   // Ready for network submission
  | 'SUBMITTED'         // Sent to payment network
  | 'CONFIRMED'         // Network confirmed receipt
  | 'SETTLED'           // Funds settled (card-specific)
  | 'COMPLETED'         // Final success state
  | 'FAILED'            // Final failure state
  | 'CANCELLED';        // Cancelled by user

// Supported network types
type NetworkType = 'stablecoin' | 'card' | 'mobile_wallet' | 'tokenized_asset';

// Core entities
interface Payment { id, quoteId, networkId, status, sender, receiver, ... }
interface Quote { id, networkId, sourceAmount, destAmount, fxRate, fee, expiresAt }
interface Network { id, type, displayName, supportedCurrencies, limits }
```

### Utilities (`packages/core/src/utils/`)

| Utility | Purpose |
|---------|---------|
| `sha256(data)` | SHA-256 hash |
| `hmacSha256(data, secret)` | HMAC signing |
| `generateId(prefix)` | ID generation (pay_xxx, quote_xxx) |
| `createFingerprint(body)` | Idempotency fingerprint |
| `generateCorrelationId()` | Request tracing UUID |

---

## Payment Flow

### Complete Payment Lifecycle

```
Client                API Gateway              Network Adapter         Webhook Service
   │                       │                          │                       │
   │  POST /v1/quotes      │                          │                       │
   │──────────────────────▶│                          │                       │
   │                       │  getQuote()              │                       │
   │                       │─────────────────────────▶│                       │
   │                       │◀─────────────────────────│                       │
   │  QuoteResponse        │                          │                       │
   │◀──────────────────────│                          │                       │
   │                       │                          │                       │
   │  POST /v1/payments    │                          │                       │
   │──────────────────────▶│                          │                       │
   │                       │ 1. Validate quote        │                       │
   │                       │ 2. Create payment        │                       │
   │                       │ 3. Lock quote            │                       │
   │                       │ 4. Compliance check      │                       │
   │                       │ 5. initiatePayment()     │                       │
   │                       │─────────────────────────▶│                       │
   │                       │◀─────────────────────────│                       │
   │                       │ 6. Store events          │                       │
   │                       │ 7. Dispatch webhook ─────────────────────────────▶│
   │  PaymentResponse      │                          │                       │
   │◀──────────────────────│                          │                       │
   │                       │                          │                       │
   │  POST /payments/:id/confirm                      │                       │
   │──────────────────────▶│                          │                       │
   │                       │  confirmPayment()        │                       │
   │                       │─────────────────────────▶│                       │
   │                       │◀─────────────────────────│                       │
   │  PaymentResponse      │                          │                       │
   │◀──────────────────────│                          │                       │
```

### Status Transitions by Network

| Network | Flow |
|---------|------|
| **Stablecoin** | CREATED → QUOTE_LOCKED → COMPLIANCE_CHECK → SUBMITTED → CONFIRMED → COMPLETED |
| **Card** | CREATED → QUOTE_LOCKED → COMPLIANCE_CHECK → PROCESSING → (REQUIRES_ACTION?) → CONFIRMED → SETTLED → COMPLETED |
| **Mobile Wallet** | CREATED → QUOTE_LOCKED → COMPLIANCE_CHECK → SUBMITTED → PENDING_USER_ACTION → CONFIRMED → COMPLETED |
| **Tokenized Asset** | CREATED → QUOTE_LOCKED → COMPLIANCE_CHECK → QUEUED → MATCHING → PENDING_CUSTODY → SETTLED → COMPLETED |

---

## Network Adapters

### Interface (`packages/network-adapters/src/interface.ts`)

```typescript
interface NetworkAdapter {
  readonly config: NetworkConfig;

  // Get FX quote with fees
  getQuote(request: QuoteRequest): Promise<NetworkQuote>;

  // Submit payment to network
  initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;

  // Confirm payment (optional - for 2-step flows)
  confirmPayment?(networkPaymentId: string): Promise<PaymentConfirmationResult>;

  // Poll payment status
  getPaymentStatus(networkPaymentId: string): Promise<NetworkPaymentStatus>;

  // Parse inbound webhook (optional)
  parseWebhook?(rawBody: Buffer, headers: Headers): Promise<NetworkWebhookEvent>;
}
```

### Implementations

| Network | Type | Status | Location |
|---------|------|--------|----------|
| **Stripe** | Card | Real (test mode) | `adapters/card/stripe.ts` |
| **Polygon USDC** | Stablecoin | Real (Amoy testnet) | `adapters/stablecoin/polygon.ts` |
| **M-Pesa** | Mobile Wallet | Mock | `adapters/mobile-wallet/mpesa.ts` |
| **GCash** | Mobile Wallet | Mock | `adapters/mobile-wallet/gcash.ts` |
| **RWA T-Bonds** | Tokenized Asset | Mock | `adapters/tokenized-assets/rwa.ts` |

### Network Configuration

| Network | Currencies | Limits | Fee |
|---------|------------|--------|-----|
| stripe-card | USD, EUR, GBP | $0.50 - $999,999 | 2.9% + $0.30 |
| polygon-amoy-usdc | USD → USDC | $1 - $10,000 | ~$0.01 gas |
| mpesa-kenya | USD → KES | $1 - $1,000 | 1.5% |
| gcash-ph | USD → PHP | $1 - $2,000 | 2% |
| rwa-treasury | USD → TBOND | $1,000 - $1M | 0.5% |

---

## State Machine

### Implementation (`packages/core/src/domain/state-machine.ts`)

```typescript
class PaymentStateMachine {
  private state: PaymentStatus;
  private networkType: NetworkType;
  private history: TransitionRecord[];

  canTransition(to: PaymentStatus): boolean;
  transition(to: PaymentStatus): void;
  getNextStates(): PaymentStatus[];
}
```

### Allowed Transitions

```
CREATED
  ├─▶ QUOTE_LOCKED
  ├─▶ CANCELLED
  └─▶ FAILED

QUOTE_LOCKED
  ├─▶ COMPLIANCE_CHECK
  ├─▶ CANCELLED
  └─▶ FAILED

COMPLIANCE_CHECK
  ├─▶ PENDING_NETWORK (approved)
  ├─▶ CANCELLED
  └─▶ FAILED (rejected)

PENDING_NETWORK
  ├─▶ SUBMITTED
  ├─▶ CANCELLED
  └─▶ FAILED

SUBMITTED
  ├─▶ CONFIRMED
  ├─▶ PENDING_USER_ACTION (mobile wallet)
  └─▶ FAILED

CONFIRMED
  ├─▶ SETTLED (card)
  ├─▶ COMPLETED
  └─▶ FAILED

SETTLED
  ├─▶ COMPLETED
  └─▶ FAILED

COMPLETED ─ (terminal)
FAILED ─ (terminal)
CANCELLED ─ (terminal)
```

---

## Event Sourcing

### Event Types (`packages/core/src/domain/events.ts`)

```typescript
type PaymentEventType =
  | 'PaymentCreated'
  | 'QuoteLocked'
  | 'ComplianceCheckStarted'
  | 'ComplianceCheckCompleted'
  | 'PaymentSubmitted'
  | 'PaymentConfirmed'
  | 'PaymentSettled'
  | 'PaymentCompleted'
  | 'PaymentFailed'
  | 'PaymentCancelled';

interface PaymentEvent {
  id: string;
  paymentId: string;
  type: PaymentEventType;
  timestamp: string;        // ISO 8601
  data: Record<string, unknown>;
  correlationId: string;
}
```

### Event Store (`packages/core/src/domain/event-store.ts`)

```typescript
class EventStore {
  append(event: PaymentEvent): void;
  getEvents(paymentId: string): PaymentEvent[];
  getLatestEvent(paymentId: string): PaymentEvent | undefined;
  getAllEvents(): PaymentEvent[];
}
```

### Webhook Event Mapping

| Internal Event | Webhook Event |
|----------------|---------------|
| PaymentCreated | payment.created |
| QuoteLocked | payment.quote_locked |
| ComplianceCheckStarted | payment.compliance_check.started |
| ComplianceCheckCompleted | payment.compliance_check.completed |
| PaymentSubmitted | payment.submitted |
| PaymentConfirmed | payment.confirmed |
| PaymentSettled | payment.settled |
| PaymentCompleted | payment.completed |
| PaymentFailed | payment.failed |
| PaymentCancelled | payment.cancelled |

---

## API Gateway

### Middleware Stack (`packages/api-gateway/src/app.ts`)

```
Request
    │
    ▼
┌─────────────────────────┐
│  1. JSON Body Parser    │
├─────────────────────────┤
│  2. Correlation ID      │  Generate/validate X-Correlation-ID
├─────────────────────────┤
│  3. Audit Logger        │  Log with PII masking
├─────────────────────────┤
│  4. Health Check        │  GET /health (no auth)
├─────────────────────────┤
│  5. Auth Middleware     │  Bearer token / X-API-Key
├─────────────────────────┤
│  6. Rate Limiter        │  Per-minute & per-day limits
├─────────────────────────┤
│  7. Route Handlers      │  /v1/networks, /v1/quotes, /v1/payments
├─────────────────────────┤
│  8. 404 Handler         │
├─────────────────────────┤
│  9. Error Handler       │  Centralized error formatting
└─────────────────────────┘
    │
    ▼
Response
```

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| GET | /v1/networks | No | List networks |
| GET | /v1/networks/:id | No | Get network details |
| GET | /v1/networks/:id/payers | No | Get required fields |
| POST | /v1/quotes | Yes | Create FX quote |
| GET | /v1/quotes/:id | Yes | Get quote |
| POST | /v1/payments | Yes | Create payment |
| GET | /v1/payments/:id | Yes | Get payment |
| POST | /v1/payments/:id/confirm | Yes | Confirm payment |
| POST | /v1/payments/:id/cancel | Yes | Cancel payment |
| GET | /v1/payments/:id/events | Yes | Get event history |

### Services

| Service | File | Purpose |
|---------|------|---------|
| Orchestrator | `services/orchestrator.ts` | Payment workflow coordination |
| QuoteService | `services/quote.ts` | Quote creation & validation |
| ComplianceService | `services/compliance.ts` | AML/sanctions checks |

---

## Webhook Service

### Architecture (`packages/webhook-service/`)

```
┌─────────────────────────────────────────────────────┐
│                  Webhook Service                     │
├─────────────────────────────────────────────────────┤
│  Inbound Handlers                                    │
│  ├─ POST /inbound/stripe   (Stripe webhooks)        │
│  ├─ POST /inbound/mpesa    (M-Pesa callbacks)       │
│  └─ Polygon Poller         (Block confirmations)    │
├─────────────────────────────────────────────────────┤
│  Webhook Registry                                    │
│  ├─ POST /v1/webhooks      (Create subscription)    │
│  ├─ GET /v1/webhooks       (List subscriptions)     │
│  └─ DELETE /v1/webhooks/:id (Remove subscription)   │
├─────────────────────────────────────────────────────┤
│  Dispatcher                                          │
│  ├─ Sign payload (HMAC-SHA256)                      │
│  ├─ Deliver with retry (exponential backoff)        │
│  └─ Track delivery attempts                          │
└─────────────────────────────────────────────────────┘
```

### Webhook Delivery

- **Signature**: HMAC-SHA256 with timestamp
- **Header**: `X-Webhook-Signature: t=<timestamp>,v1=<signature>`
- **Retries**: 5 attempts with exponential backoff
- **Timeout**: 30 seconds per attempt

---

## Security

### Authentication

```
┌─────────────────────────────────────────┐
│  Request Headers                         │
│  ├─ Authorization: Bearer <api_key>     │
│  └─ X-API-Key: <api_key>                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Auth Middleware                         │
│  ├─ Extract key from header             │
│  ├─ Lookup in config.apiKeys            │
│  ├─ Validate client exists              │
│  └─ Attach { clientId, scopes } to req  │
└─────────────────────────────────────────┘
```

### Request Signing (High-Value Transactions)

```typescript
// Header format
X-Signature: t=<unix_timestamp>,v1=<hmac_signature>

// Signature computation
signature = HMAC-SHA256(
  secret,
  `${timestamp}.${JSON.stringify(body)}`
)
```

### Audit Logging

**Sensitive fields redacted**: cardNumber, cvv, password, secret, apiKey, ssn, privateKey

**PII fields masked**: email → `jo****@example.com`, phone → `+1****5678`

### Rate Limiting

| Limit Type | Default | Headers |
|------------|---------|---------|
| Per minute | 30 req/min | X-RateLimit-Limit-Minute |
| Per day | 500 req/day | X-RateLimit-Limit-Day |
| Retry after | - | Retry-After |

---

## Data Stores

All stores are in-memory (suitable for development/demo, requires database for production).

| Store | Package | Purpose |
|-------|---------|---------|
| EventStore | core | Immutable event log |
| PaymentStore | api-gateway | Payment entity storage |
| QuoteStore | api-gateway | Quote storage with TTL |
| WebhookRegistry | webhook-service | Subscription management |
| RateLimitStore | api-gateway | Request counting |

---

## File Reference

### Core Package

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Domain types (Payment, Quote, Network) |
| `src/domain/state-machine.ts` | Payment state machine |
| `src/domain/events.ts` | Event types & factory |
| `src/domain/event-store.ts` | In-memory event store |
| `src/utils/crypto.ts` | SHA256, HMAC utilities |
| `src/utils/idempotency.ts` | Request fingerprinting |
| `src/utils/correlation.ts` | Correlation ID generation |

### API Gateway

| File | Purpose |
|------|---------|
| `src/app.ts` | Express app setup |
| `src/routes/v1/payments.ts` | Payment endpoints |
| `src/routes/v1/quotes.ts` | Quote endpoints |
| `src/routes/v1/networks.ts` | Network endpoints |
| `src/middleware/auth.ts` | API key authentication |
| `src/middleware/rate-limit.ts` | Rate limiting |
| `src/middleware/audit-log.ts` | PII-safe logging |
| `src/services/orchestrator.ts` | Payment workflow |
| `src/services/compliance.ts` | AML/sanctions checks |

### Network Adapters

| File | Purpose |
|------|---------|
| `src/interface.ts` | NetworkAdapter interface |
| `src/factory.ts` | Adapter factory & configs |
| `src/adapters/card/stripe.ts` | Stripe integration |
| `src/adapters/stablecoin/polygon.ts` | Polygon USDC |
| `src/adapters/mobile-wallet/mpesa.ts` | M-Pesa mock |
| `src/adapters/mobile-wallet/gcash.ts` | GCash mock |
| `src/adapters/tokenized-assets/rwa.ts` | RWA mock |

### Webhook Service

| File | Purpose |
|------|---------|
| `src/app.ts` | Express app setup |
| `src/dispatcher/dispatcher.ts` | Webhook delivery |
| `src/dispatcher/signer.ts` | HMAC signing |
| `src/dispatcher/registry.ts` | Subscription storage |
| `src/handlers/stripe.ts` | Stripe webhook handler |
| `src/handlers/mpesa.ts` | M-Pesa callback handler |

### SDK

| File | Purpose |
|------|---------|
| `src/client.ts` | CrossBorderClient class |
| `src/resources/payments.ts` | Payments resource |
| `src/resources/quotes.ts` | Quotes resource |
| `src/resources/networks.ts` | Networks resource |
| `src/errors.ts` | Error types |

---

## Environment Variables

```bash
# Server
PORT=4000
NODE_ENV=development

# Authentication
API_KEYS='{"demo_key":{"clientId":"demo","scopes":["*"]}}'
SIGNATURE_SECRET=your_signing_secret
SIGNATURE_THRESHOLD=10000

# Stripe (Card Payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Polygon (Stablecoin)
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_PRIVATE_KEY=0x...

# Webhooks
WEBHOOK_SECRET=whsec_demo
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start services (Docker)
docker compose up -d

# Verify
curl http://localhost:4000/health
curl http://localhost:4000/v1/networks

# Run tests
npm run test:unit
npm run test:e2e
```
