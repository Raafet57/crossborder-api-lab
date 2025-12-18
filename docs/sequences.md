# Sequences

## Happy path (COMPLETED)
```
Partner CLI        Mock API (4000)                 Webhook receiver (4002)
    |                    |                                  |
    | GET /v1/payers     |                                  |
    |------------------->|                                  |
    | 200 payers[]       |                                  |
    |<-------------------|                                  |
    |                    |                                  |
    | POST /v1/quotations (Idempotency-Key)                 |
    |------------------->|                                  |
    | 200 quote{id}      |                                  |
    |<-------------------|                                  |
    |                    |                                  |
    | POST /v1/quotations/{quoteId}/transactions (Idempotency-Key)
    |------------------->|                                  |
    | 201 tx{status=PENDING}                                |
    |<-------------------|                                  |
    |                    |                                  |
    | POST /v1/transactions/{txId}/confirm                  |
    |------------------->|                                  |
    | 200 tx{status=CONFIRMED}                              |
    |<-------------------|                                  |
    |                    |                                  |
    |            (after ~500ms) POST /webhooks/thunes (X-Sig)|
    |                    |--------------------------------->|
    |                    |                 200              |
    |                    |<---------------------------------|
    |                    |                                  |
    | GET /events/{txId} |--------------------------------->|
    | 200 event{status=COMPLETED}                           |
    |<------------------------------------------------------|
    |                    |                                  |
    | GET /v1/transactions/{txId}                           |
    |------------------->|                                  |
    | 200 tx{status=COMPLETED}                              |
    |<-------------------|                                  |
```

## Reject path (REJECTED)
```
Partner CLI        Mock API (4000)                 Webhook receiver (4002)
    |                    |                                  |
    | ... quote + create transaction ...                    |
    |                    |                                  |
    | POST /v1/transactions/{txId}/confirm                  |
    |------------------->|                                  |
    | 200 tx{status=CONFIRMED}                              |
    |<-------------------|                                  |
    |                    |                                  |
    |            (after ~500ms) POST /webhooks/thunes (X-Sig)|
    |                    |--------------------------------->|
    |                    | 200                              |
    |                    |<---------------------------------|
    |                    |                                  |
    | GET /events/{txId} |--------------------------------->|
    | 200 event{status=REJECTED,rejection_reason}           |
    |<------------------------------------------------------|
    |                    |                                  |
    | GET /v1/transactions/{txId}                           |
    |------------------->|                                  |
    | 200 tx{status=REJECTED,rejection_reason}              |
    |<-------------------|                                  |
```

