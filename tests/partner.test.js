const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { promises: fs } = require("fs");

const uuidV4Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : null;
  if (!port) throw new Error("Failed to bind server");
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function runPartnerCli(args, env) {
  const cliPath = path.join(
    __dirname,
    "..",
    "partner-app",
    "dist",
    "index.js",
  );

  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (buf) => {
    stdout += buf.toString("utf8");
  });
  child.stderr.on("data", (buf) => {
    stderr += buf.toString("utf8");
  });

  const code = await new Promise((resolve) => child.on("close", resolve));

  if (code !== 0) {
    const err = new Error(
      `partner-app exited with code ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    err.code = code;
    throw err;
  }

  return { stdout, stderr };
}

test("partner CLI sets headers and runs discover->quote->create->confirm->status flow", async () => {
  const requests = [];
  const txId = "TX_1";
  const quoteId = "QUOTE_1";
  let webhookEvent = null;
  let transactionStatus = "PENDING";

  const webhookReceiver = await startServer((req, res) => {
    if (req.method === "GET" && req.url === `/events/${txId}`) {
      if (!webhookEvent) {
        json(res, 404, { code: "NOT_FOUND" });
        return;
      }
      json(res, 200, webhookEvent);
      return;
    }

    json(res, 404, { code: "NOT_FOUND" });
  });

  const apiServer = await startServer(async (req, res) => {
    const bodyText = await readBody(req);
    const body = bodyText ? JSON.parse(bodyText) : null;

    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    });

    if (req.method === "GET" && req.url === "/v1/payers") {
      json(res, 200, [
        {
          id: "P1",
          country: "PH",
          currency_pairs: [{ source_currency: "SGD", dest_currency: "PHP" }],
          required_fields: [],
          min_amount: 10,
          max_amount: 1000,
        },
        {
          id: "P2",
          country: "IN",
          currency_pairs: [{ source_currency: "USD", dest_currency: "INR" }],
          required_fields: [],
          min_amount: 5,
          max_amount: 5000,
        },
        {
          id: "P3",
          country: "ID",
          currency_pairs: [{ source_currency: "SGD", dest_currency: "IDR" }],
          required_fields: [],
          min_amount: 20,
          max_amount: 2000,
        },
      ]);
      return;
    }

    if (req.method === "POST" && req.url === "/v1/quotations") {
      json(res, 200, {
        id: quoteId,
        fx_rate: 41.25,
        fee: 1.5,
        source_amount: 100,
        dest_amount: 4050,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
      return;
    }

    if (
      req.method === "POST" &&
      req.url === `/v1/quotations/${encodeURIComponent(quoteId)}/transactions`
    ) {
      transactionStatus = "PENDING";
      const nowIso = new Date().toISOString();
      json(res, 201, {
        id: txId,
        quote_id: quoteId,
        payer_id: "P1",
        external_id: body.external_id,
        sender: body.sender,
        receiver: body.receiver,
        purpose: body.purpose,
        status: transactionStatus,
        created_at: nowIso,
        updated_at: nowIso,
      });
      return;
    }

    if (
      req.method === "POST" &&
      req.url === `/v1/transactions/${encodeURIComponent(txId)}/confirm`
    ) {
      transactionStatus = "CONFIRMED";
      const nowIso = new Date().toISOString();

      setTimeout(() => {
        transactionStatus = "COMPLETED";
        webhookEvent = {
          id: "evt_1",
          type: "transaction.updated",
          created_at: new Date().toISOString(),
          data: {
            transaction: {
              id: txId,
              quote_id: quoteId,
              payer_id: "P1",
              external_id: "EXT123",
              sender: {},
              receiver: {},
              purpose: "Salary",
              status: transactionStatus,
              created_at: nowIso,
              updated_at: new Date().toISOString(),
            },
          },
        };
      }, 300);

      json(res, 200, {
        id: txId,
        quote_id: quoteId,
        payer_id: "P1",
        external_id: "EXT123",
        sender: {},
        receiver: {},
        purpose: "Salary",
        status: transactionStatus,
        created_at: nowIso,
        updated_at: nowIso,
      });
      return;
    }

    if (req.method === "GET" && req.url === `/v1/transactions/${txId}`) {
      const nowIso = new Date().toISOString();
      json(res, 200, {
        id: txId,
        quote_id: quoteId,
        payer_id: "P1",
        external_id: "EXT123",
        sender: {},
        receiver: {},
        purpose: "Salary",
        status: transactionStatus,
        created_at: nowIso,
        updated_at: nowIso,
      });
      return;
    }

    json(res, 404, { code: "NOT_FOUND" });
  });

  const idkDir = path.join(__dirname, "..", "partner-app", ".idk");
  await fs.rm(idkDir, { recursive: true, force: true });

  try {
    const env = {
      API_BASE_URL: apiServer.baseUrl,
      WEBHOOK_RECEIVER_URL: webhookReceiver.baseUrl,
      AUTH_KEY: "demo_key",
    };

    const discoverOut = await runPartnerCli(["discover"], env);
    expect(discoverOut.stdout).toContain("id");
    expect(discoverOut.stdout).toContain("country");

    const quoteOut1 = await runPartnerCli(
      ["quote", "--src", "100", "--scur", "SGD", "--dcurr", "PHP", "--payer", "P1", "--mode", "SOURCE"],
      env,
    );
    expect(quoteOut1.stdout).toContain(`"id": "${quoteId}"`);

    const quoteOut2 = await runPartnerCli(
      ["quote", "--src", "100", "--scur", "SGD", "--dcurr", "PHP", "--payer", "P1", "--mode", "SOURCE"],
      env,
    );
    expect(quoteOut2.stdout).toContain(`"id": "${quoteId}"`);

    const createOut = await runPartnerCli(
      [
        "create",
        "--quote",
        quoteId,
        "--ext",
        "EXT123",
        "--sender",
        "./fixtures/sender.json",
        "--receiver",
        "./fixtures/receiver.json",
        "--purpose",
        "Salary",
      ],
      env,
    );
    expect(createOut.stdout).toContain(`"id": "${txId}"`);

    const confirmOut = await runPartnerCli(["confirm", "--tx", txId], env);
    expect(confirmOut.stdout).toContain(`"id": "${txId}"`);
    expect(confirmOut.stdout).toContain("Webhook summary");
    expect(confirmOut.stdout).toContain(`"status": "COMPLETED"`);

    const statusOut = await runPartnerCli(["status", "--tx", txId], env);
    expect(statusOut.stdout).toContain(`"status": "COMPLETED"`);

    for (const req of requests) {
      expect(req.headers.authorization).toBe("Bearer demo_key");
      expect(req.headers["x-correlation-id"]).toMatch(uuidV4Regex);
    }

    const postRequests = requests.filter((req) => req.method === "POST");
    for (const req of postRequests) {
      expect(req.headers["idempotency-key"]).toMatch(uuidV4Regex);
    }

    const quoteRequests = requests.filter(
      (req) => req.method === "POST" && req.url === "/v1/quotations",
    );
    expect(quoteRequests).toHaveLength(2);
    expect(quoteRequests[0].headers["idempotency-key"]).toBe(
      quoteRequests[1].headers["idempotency-key"],
    );
  } finally {
    apiServer.server.close();
    webhookReceiver.server.close();
  }
});

