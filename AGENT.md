crosborder-api-lab 

# AGENTS.md

Project name
crosborder-api-lab

Mission
Build a tiny cross-border payout lab to learn REST, JSON, webhooks, idempotency, auth, error models, reconciliation, and versioning by implementing both sides.

Repo layout target
- mock-network-api           Node 20 + Express + TypeScript mock payout API
- partner-app                Node 20 + TypeScript CLI that calls the API
- webhook-receiver           Node 20 + Express + TypeScript webhook server
- docs                       short specs and sequences
- postman                    collection and environment
- tests                      jest suites for api, webhook, partner

Languages and tools
- Node 20
- TypeScript
- Express
- Jest + supertest
- crypto for HMAC
- No DB, no ORM, in memory only
- No UI

Environments and keys
- AUTH_KEY=demo_key
- WEBHOOK_URL=http://localhost:4002/webhooks/thunes
- WEBHOOK_SECRET=whsec_demo
- PORTS
  - mock-network-api on 4000
  - webhook-receiver on 4002

Style rules
- Keep functions small
- Pure JSON over HTTP
- No side effects in helpers
- Strong typing at edges
- Return structured error bodies for 4xx
- Log with correlation id

Definition of done
- All endpoints implemented and tested
- Webhook signature verified
- Idempotency enforced on POST endpoints
- Rate limit returns 429 with retry hint
- Partner CLI flow works end to end
- Postman collection runs green
- Docs explain API, webhooks, idempotency, sequences, runbook

Run commands
- mock-network-api
  - npm install
  - npm run dev
  - npm test
- webhook-receiver
  - npm install
  - npm run dev
  - npm test
- partner-app
  - npm install
  - npm run start
  - npm test

Acceptance criteria
- Discover returns 3 payers with required_fields and limits
- Quote locks fx_rate and fee and expires_at is in the future
- Create from quote produces status PENDING and stores link to quote
- Confirm emits a signed webhook that flips status to COMPLETED or REJECTED
- GET status returns the latest transaction snapshot
- Idempotency same key same body returns same result
- Idempotency same key different body returns 409
- Webhook HMAC invalid returns 400
- 429 is returned after 5 requests per second per IP with Retry-After header
- Partner CLI prints neat output and uses Authorization, X-Correlation-Id, and Idempotency-Key

Ground rules for you, the coding agent
- Do not add libraries beyond express, jest, supertest, types for node and express
- Do not introduce a database
- Do not change agreed endpoints without updating docs and tests
- Keep code in TypeScript
- Keep secrets in env
- Prefer small pure helpers

Step prompts
Paste each prompt after the previous step is complete and tests pass.

Step 1 init monorepo
Create the monorepo crosborder-api-lab with folders:
- mock-network-api
- partner-app
- webhook-receiver
- docs
- postman
- tests
Add a root README with run instructions for all apps. Add a root .nvmrc with 20.11.0. Add a root package.json with workspaces that points to the three apps. No UI, no DB.

Step 2 mock API skeleton
In mock-network-api scaffold an Express TypeScript service on port 4000. Add scripts:
- dev ts-node-dev src/index.ts
- build tsc
- start node dist/index.js
Add middleware
- express.json
- request id generator using X-Correlation-Id pass through
- auth check on protected routes that enforces Authorization Bearer demo_key
Define types
- Payer
- Quote
- Transaction
Build in memory stores for payers, quotes, transactions.

Step 3 implement v1 endpoints
Implement:
GET /v1/payers
- Return 3 example payers with id, country, currency pairs, required_fields array, min_amount, max_amount.

POST /v1/quotations
- Body { source_amount, source_currency, dest_currency, payer_id, mode }
- Validate fields and limits, compute fx_rate and fee, and return { id, fx_rate, fee, source_amount, dest_amount, expires_at }.
- Enforce Idempotency-Key header. Same key and same body returns same id. Same key and different body returns 409 with error object { code, message, details }.

POST /v1/quotations/:id/transactions
- Body { external_id, sender, receiver, purpose }
- Validate required_fields per payer
- Create transaction with status PENDING and link to quote_id, echo external_id
- Enforce Idempotency-Key same rule as above
- Return 201 and full transaction

POST /v1/transactions/:id/confirm
- Body {}
- Set status CONFIRMED now
- After 500 ms trigger a webhook to WEBHOOK_URL with type transaction.updated
- 10 percent chance set final status REJECTED with reason code
- Else set final status COMPLETED
- Always sign the webhook body with HMAC SHA256 using WEBHOOK_SECRET into header X-Sig
- Return 200 with the current transaction snapshot

GET /v1/transactions/:id
- Return the latest transaction

Rate limit
- Simple in-memory counter per IP for 1 second window
- If over 5 requests per second return 429 with Retry-After header

Errors
- Use standard HTTP codes and body shape { code, message, details }
- For 401 set WWW-Authenticate Bearer realm demo

Step 4 webhook receiver
In webhook-receiver build Express TypeScript server on 4002.
- Raw body parser for the webhook route
- POST /webhooks/thunes
  - Verify HMAC SHA256 signature from X-Sig
  - If valid store latest event by transaction id in memory and return 200
  - If invalid return 400 with { code: "BAD_SIGNATURE" }
- GET /events/:txId returns last stored event or 404

Step 5 partner CLI
In partner-app build a TypeScript CLI using node builtin modules only.
Commands
- discover calls GET /v1/payers and prints a table
- quote flags --src 100 --scur SGD --dcurr PHP --payer P1 --mode SOURCE prints quote
- create flags --quote QUOTE_ID --ext EXT123 --sender ./fixtures/sender.json --receiver ./fixtures/receiver.json --purpose "Salary" prints tx
- confirm flags --tx TX_ID prints tx then waits and prints webhook summary from webhook receiver
- status flags --tx TX_ID prints latest tx
All requests set Authorization Bearer demo_key, X-Correlation-Id uuid, Idempotency-Key for POST. Persist last used idempotency keys under .idk cache per command so a re run can demonstrate replay.

Step 6 tests
Create tests in tests using Jest and supertest.
backend.test.ts
- Quotation idempotency same body same result
- Quotation idempotency different body returns 409
- Create transaction validates required_fields
- Confirm triggers webhook and webhook-receiver validates signature

webhook.test.ts
- Valid signature accepted, invalid rejected

partner.test.ts
- Use nock or plain fetch mock to assert headers and flow for discover, quote, create, confirm, status

Step 7 postman
Create postman collection and environment with pre-request scripts that inject Authorization, X-Correlation-Id, Idempotency-Key. Add tests that assert 2xx, schema keys, and save ids into environment variables.

Step 8 docs
Docs to write under docs
- api-spec.md request and response examples for each endpoint and error shapes
- webhooks.md how to verify signature and retry policy
- idempotency.md server rules, body hash, key reuse policy, examples of 201 replay vs 409
- sequences.md happy path and reject path as text sequence diagrams
- runbook.md how to run all three processes, run a demo, reproduce 409, reproduce 429, reconcile a missed webhook using GET status and GET event

Non goals
- No real FX provider
- No PCI or PAN data
- No persistence
- No SDKs or UI

Checklist for completion
- Three processes run cleanly
- Happy path works end to end on CLI and Postman
- Webhook signature verified
- Idempotency works as designed
- Tests all pass
- Docs read cleanly and match endpoints
