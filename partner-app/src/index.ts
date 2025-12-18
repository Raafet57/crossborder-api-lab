import { API_BASE_URL, WEBHOOK_RECEIVER_URL } from "./config";
import { getOrCreateIdempotencyKey } from "./idempotency";
import { readJsonFile } from "./io";
import { HttpError, requestJson } from "./http";
import { printJson, printTable } from "./output";
import { Payer, Quote, QuoteMode, Transaction, WebhookEvent } from "./types";

type Flags = Record<string, string>;

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Flags = {};
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i] ?? "";
    if (token.startsWith("--")) {
      const name = token.slice(2);
      const value = rest[i + 1];
      if (!value || value.startsWith("--")) {
        flags[name] = "true";
      } else {
        flags[name] = value;
        i += 1;
      }
    } else {
      positionals.push(token);
    }
  }

  return { command, flags, positionals };
}

function requireFlag(flags: Flags, name: string): string {
  const value = flags[name];
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

function parseNumberFlag(flags: Flags, name: string): number {
  const raw = requireFlag(flags, name);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid number for --${name}`);
  return value;
}

async function cmdDiscover() {
  const payers = await requestJson<Payer[]>({
    method: "GET",
    url: `${API_BASE_URL}/v1/payers`,
  });

  printTable(
    ["id", "country", "pairs", "min", "max"],
    payers.map((payer) => [
      payer.id,
      payer.country,
      payer.currency_pairs
        .map((pair) => `${pair.source_currency}->${pair.dest_currency}`)
        .join(","),
      payer.min_amount,
      payer.max_amount,
    ]),
  );
}

async function cmdQuote(flags: Flags) {
  const sourceAmount = parseNumberFlag(flags, "src");
  const sourceCurrency = requireFlag(flags, "scur");
  const destCurrency = requireFlag(flags, "dcurr");
  const payerId = requireFlag(flags, "payer");
  const mode = requireFlag(flags, "mode").toUpperCase() as QuoteMode;

  if (mode !== "SOURCE" && mode !== "DEST") {
    throw new Error(`--mode must be SOURCE or DEST`);
  }

  const idempotencyKey = await getOrCreateIdempotencyKey("quote");
  const quote = await requestJson<Quote>({
    method: "POST",
    url: `${API_BASE_URL}/v1/quotations`,
    idempotencyKey,
    body: {
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
      dest_currency: destCurrency,
      payer_id: payerId,
      mode,
    },
  });

  printJson(quote);
}

async function cmdCreate(flags: Flags) {
  const quoteId = requireFlag(flags, "quote");
  const externalId = requireFlag(flags, "ext");
  const senderPath = requireFlag(flags, "sender");
  const receiverPath = requireFlag(flags, "receiver");
  const purpose = requireFlag(flags, "purpose");

  const sender = await readJsonFile(senderPath);
  const receiver = await readJsonFile(receiverPath);

  const idempotencyKey = await getOrCreateIdempotencyKey("create");
  const transaction = await requestJson<Transaction>({
    method: "POST",
    url: `${API_BASE_URL}/v1/quotations/${encodeURIComponent(quoteId)}/transactions`,
    idempotencyKey,
    body: {
      external_id: externalId,
      sender,
      receiver,
      purpose,
    },
  });

  printJson(transaction);
}

async function cmdStatus(flags: Flags) {
  const transactionId = requireFlag(flags, "tx");
  const transaction = await requestJson<Transaction>({
    method: "GET",
    url: `${API_BASE_URL}/v1/transactions/${encodeURIComponent(transactionId)}`,
  });

  printJson(transaction);
}

async function cmdConfirm(flags: Flags) {
  const transactionId = requireFlag(flags, "tx");
  const idempotencyKey = await getOrCreateIdempotencyKey("confirm");

  const transaction = await requestJson<Transaction>({
    method: "POST",
    url: `${API_BASE_URL}/v1/transactions/${encodeURIComponent(transactionId)}/confirm`,
    idempotencyKey,
    body: {},
  });

  printJson(transaction);

  const event = await waitForEvent(transactionId, 6000);
  if (!event) {
    console.error("No webhook event received (timed out)");
    return;
  }

  const status = event.data.transaction.status;
  const summary: Record<string, unknown> = {
    type: event.type,
    transaction_id: event.data.transaction.id,
    status,
  };

  if (status === "REJECTED") {
    summary.rejection_reason = event.data.transaction.rejection_reason ?? null;
  }

  console.log("\nWebhook summary");
  printJson(summary);
}

async function waitForEvent(
  txId: string,
  timeoutMs: number,
): Promise<WebhookEvent | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const event = await requestJson<WebhookEvent>({
        method: "GET",
        url: `${WEBHOOK_RECEIVER_URL}/events/${encodeURIComponent(txId)}`,
      });
      return event;
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        await sleep(250);
        continue;
      }
      throw err;
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function printUsage() {
  console.log(`Usage:
  discover
  quote --src 100 --scur SGD --dcurr PHP --payer P1 --mode SOURCE
  create --quote QUOTE_ID --ext EXT123 --sender ./fixtures/sender.json --receiver ./fixtures/receiver.json --purpose "Salary"
  confirm --tx TX_ID
  status --tx TX_ID
`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help === "true") {
    printUsage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  try {
    switch (command) {
      case "discover":
        await cmdDiscover();
        break;
      case "quote":
        await cmdQuote(flags);
        break;
      case "create":
        await cmdCreate(flags);
        break;
      case "confirm":
        await cmdConfirm(flags);
        break;
      case "status":
        await cmdStatus(flags);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      console.error(`HTTP ${err.status}: ${err.message}`);
      if (err.body) console.error(JSON.stringify(err.body, null, 2));
      process.exitCode = 1;
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
