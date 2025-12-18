const request = require("supertest");
const path = require("path");

const AUTH_HEADER = "Bearer demo_key";

function loadMockApi(extraEnv = {}) {
  jest.resetModules();
  process.env.AUTH_KEY = "demo_key";
  Object.assign(process.env, extraEnv);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(path.join(
    __dirname,
    "..",
    "mock-network-api",
    "dist",
    "app.js",
  ));

  return createApp();
}

function auth(req) {
  return req.set("Authorization", AUTH_HEADER);
}

async function waitForWebhookEvent(baseUrl, txId, timeoutMs = 5000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(
      `${baseUrl}/events/${encodeURIComponent(txId)}`,
      { method: "GET" },
    );

    if (res.status === 200) return res.json();
    if (res.status !== 404) {
      throw new Error(`Unexpected webhook receiver status ${res.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for webhook event");
}

test("Quotation idempotency: same body + same key returns same id", async () => {
  const app = loadMockApi();
  const body = {
    source_amount: 100,
    source_currency: "SGD",
    dest_currency: "PHP",
    payer_id: "P1",
    mode: "SOURCE",
  };
  const key = `quote-idk-${Date.now()}`;

  const res1 = await auth(request(app).post("/v1/quotations"))
    .set("Idempotency-Key", key)
    .send(body)
    .expect(200);

  const res2 = await auth(request(app).post("/v1/quotations"))
    .set("Idempotency-Key", key)
    .send(body)
    .expect(200);

  expect(res2.body.id).toBe(res1.body.id);
});

test("Quotation idempotency: same key + different body returns 409", async () => {
  const app = loadMockApi();
  const key = `quote-idk-${Date.now()}`;

  await auth(request(app).post("/v1/quotations"))
    .set("Idempotency-Key", key)
    .send({
      source_amount: 100,
      source_currency: "SGD",
      dest_currency: "PHP",
      payer_id: "P1",
      mode: "SOURCE",
    })
    .expect(200);

  const res2 = await auth(request(app).post("/v1/quotations"))
    .set("Idempotency-Key", key)
    .send({
      source_amount: 101,
      source_currency: "SGD",
      dest_currency: "PHP",
      payer_id: "P1",
      mode: "SOURCE",
    })
    .expect(409);

  expect(res2.body).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});

test("Create transaction validates required_fields and returns 201", async () => {
  const app = loadMockApi();

  const quoteRes = await auth(request(app).post("/v1/quotations"))
    .set("Idempotency-Key", `quote-${Date.now()}`)
    .send({
      source_amount: 100,
      source_currency: "SGD",
      dest_currency: "PHP",
      payer_id: "P1",
      mode: "SOURCE",
    })
    .expect(200);

  const quoteId = quoteRes.body.id;

  const invalidRes = await auth(
    request(app).post(`/v1/quotations/${encodeURIComponent(quoteId)}/transactions`),
  )
    .set("Idempotency-Key", `tx-${Date.now()}-invalid`)
    .send({
      external_id: "EXT123",
      sender: { first_name: "Jane", last_name: "Doe" },
      receiver: { first_name: "Juan", last_name: "Dela Cruz" },
      purpose: "Salary",
    })
    .expect(400);

  expect(invalidRes.body).toMatchObject({ code: "MISSING_REQUIRED_FIELDS" });

  const validRes = await auth(
    request(app).post(`/v1/quotations/${encodeURIComponent(quoteId)}/transactions`),
  )
    .set("Idempotency-Key", `tx-${Date.now()}-valid`)
    .send({
      external_id: "EXT123",
      sender: { first_name: "Jane", last_name: "Doe" },
      receiver: {
        first_name: "Juan",
        last_name: "Dela Cruz",
        bank_account: "1234567890",
      },
      purpose: "Salary",
    })
    .expect(201);

  expect(validRes.body).toMatchObject({
    quote_id: quoteId,
    payer_id: "P1",
    external_id: "EXT123",
    status: "PENDING",
  });
});

test("Confirm triggers webhook; webhook-receiver validates X-Sig", async () => {
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp: createWebhookReceiverApp } = require(path.join(
    __dirname,
    "..",
    "webhook-receiver",
    "dist",
    "app.js",
  ));

  const receiverApp = createWebhookReceiverApp();
  const receiverServer = receiverApp.listen(0, "127.0.0.1");

  await new Promise((resolve) => receiverServer.once("listening", resolve));

  const address = receiverServer.address();
  const receiverPort = address && typeof address === "object" ? address.port : null;
  if (!receiverPort) throw new Error("Failed to start webhook receiver server");

  const receiverBaseUrl = `http://127.0.0.1:${receiverPort}`;
  const webhookUrl = `${receiverBaseUrl}/webhooks/thunes`;

  const apiApp = loadMockApi({
    WEBHOOK_URL: webhookUrl,
    WEBHOOK_SECRET: "whsec_demo",
  });

  try {
    const quoteRes = await auth(request(apiApp).post("/v1/quotations"))
      .set("Idempotency-Key", `quote-${Date.now()}`)
      .send({
        source_amount: 100,
        source_currency: "SGD",
        dest_currency: "PHP",
        payer_id: "P1",
        mode: "SOURCE",
      })
      .expect(200);

    const quoteId = quoteRes.body.id;

    const txRes = await auth(
      request(apiApp).post(
        `/v1/quotations/${encodeURIComponent(quoteId)}/transactions`,
      ),
    )
      .set("Idempotency-Key", `tx-${Date.now()}`)
      .send({
        external_id: "EXT999",
        sender: { first_name: "Jane", last_name: "Doe" },
        receiver: {
          first_name: "Juan",
          last_name: "Dela Cruz",
          bank_account: "1234567890",
        },
        purpose: "Salary",
      })
      .expect(201);

    const txId = txRes.body.id;

    const confirmRes = await auth(
      request(apiApp).post(`/v1/transactions/${encodeURIComponent(txId)}/confirm`),
    )
      .set("Idempotency-Key", `confirm-${Date.now()}`)
      .send({})
      .expect(200);

    expect(confirmRes.body).toMatchObject({ id: txId, status: "CONFIRMED" });

    const event = await waitForWebhookEvent(receiverBaseUrl, txId);
    expect(event).toMatchObject({
      type: "transaction.updated",
      data: { transaction: { id: txId } },
    });

    const finalStatus = event.data.transaction.status;
    expect(["COMPLETED", "REJECTED"]).toContain(finalStatus);
  } finally {
    receiverServer.close();
  }
});

