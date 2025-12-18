const request = require("supertest");
const path = require("path");
const { createHmac } = require("crypto");

function loadWebhookReceiver() {
  jest.resetModules();
  process.env.WEBHOOK_SECRET = "whsec_demo";

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(path.join(
    __dirname,
    "..",
    "webhook-receiver",
    "dist",
    "app.js",
  ));

  return createApp();
}

test("Valid signature gets 200", async () => {
  const app = loadWebhookReceiver();

  const bodyText = JSON.stringify({
    id: "evt_1",
    type: "transaction.updated",
    created_at: new Date().toISOString(),
    data: { transaction: { id: "tx_1" } },
  });
  const sig = createHmac("sha256", "whsec_demo").update(bodyText).digest("hex");

  await request(app)
    .post("/webhooks/thunes")
    .set("X-Sig", sig)
    .set("Content-Type", "application/json")
    .send(bodyText)
    .expect(200);
});

test("Invalid signature gets 400", async () => {
  const app = loadWebhookReceiver();

  const bodyText = JSON.stringify({
    id: "evt_1",
    type: "transaction.updated",
    created_at: new Date().toISOString(),
    data: { transaction: { id: "tx_1" } },
  });

  const res = await request(app)
    .post("/webhooks/thunes")
    .set("X-Sig", "deadbeef")
    .set("Content-Type", "application/json")
    .send(bodyText)
    .expect(400);

  expect(res.body).toEqual({ code: "BAD_SIGNATURE" });
});
