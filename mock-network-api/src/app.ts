import { createHash, createHmac, randomUUID } from "crypto";
import express, { NextFunction, Request, Response } from "express";
import { requireAuth } from "./middleware/auth";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { payers, quotesById, transactionsById } from "./stores";
import { Payer, Quote, QuoteMode, Transaction } from "./types";

type ErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

type IdempotencyEntry<T> = {
  fingerprint: string;
  response: T;
  created_at: string;
};

const quoteIdempotencyByKey = new Map<string, IdempotencyEntry<unknown>>();
const transactionIdempotencyByKey = new Map<string, IdempotencyEntry<unknown>>();

const FX_RATES: Record<string, number> = {
  "SGD:PHP": 41.25,
  "USD:INR": 83.15,
  "SGD:IDR": 11600,
};

const FEE_PCT = 0.01;
const FEE_BASE = 0.5;
const QUOTE_TTL_MS = 2 * 60 * 1000;

const WEBHOOK_URL =
  process.env.WEBHOOK_URL ?? "http://localhost:4002/webhooks/thunes";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "whsec_demo";

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  const payload: ErrorBody = { code, message, details };
  res.status(status).json(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeJson(value[key]);
    }
    return normalized;
  }
  return value;
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function requestFingerprint(req: Request): string {
  const snapshot = {
    method: req.method,
    path: req.originalUrl.split("?")[0],
    body: req.body ?? null,
  };
  return sha256Hex(stableJsonString(snapshot));
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseAmount(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(raw)) return null;
  return raw;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

function resolvePayer(payerId: string): Payer | null {
  return payers.find((payer) => payer.id === payerId) ?? null;
}

function payerSupportsPair(
  payer: Payer,
  sourceCurrency: string,
  destCurrency: string,
): boolean {
  return payer.currency_pairs.some(
    (pair) =>
      normalizeCurrency(pair.source_currency) === sourceCurrency &&
      normalizeCurrency(pair.dest_currency) === destCurrency,
  );
}

function quoteResponse(quote: Quote) {
  return {
    id: quote.id,
    fx_rate: quote.fx_rate,
    fee: quote.fee,
    source_amount: quote.source_amount,
    dest_amount: quote.dest_amount,
    expires_at: quote.expires_at,
  };
}

function getValueAtPath(
  payload: Record<string, unknown>,
  dottedPath: string,
): unknown {
  const parts = dottedPath.split(".").map((token) => token.trim());
  let current: unknown = payload;
  for (const part of parts) {
    if (!part) return undefined;
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

async function sendWebhook(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sig": signature,
      },
      body,
    });
  } catch (err) {
    console.error("Webhook delivery failed", err);
  }
}

async function finalizeTransaction(transactionId: string) {
  const transaction = transactionsById.get(transactionId);
  if (!transaction) return;
  if (transaction.status !== "CONFIRMED") return;

  const rejected = Math.random() < 0.1;
  transaction.status = rejected ? "REJECTED" : "COMPLETED";
  if (rejected) {
    transaction.rejection_reason = {
      code: "REJECTED_DEMO",
      message: "Rejected by demo rule",
    };
  } else {
    delete transaction.rejection_reason;
  }
  transaction.updated_at = new Date().toISOString();

  await sendWebhook({
    id: randomUUID(),
    type: "transaction.updated",
    created_at: new Date().toISOString(),
    data: { transaction },
  });
}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(correlationIdMiddleware);

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1", rateLimitMiddleware);
  app.use("/v1", requireAuth);

  app.get("/v1/payers", (_req: Request, res: Response) => {
    res.status(200).json(
      payers.map((payer) => ({
        id: payer.id,
        country: payer.country,
        currency_pairs: payer.currency_pairs,
        required_fields: payer.required_fields,
        min_amount: payer.min_amount,
        max_amount: payer.max_amount,
      })),
    );
  });

  app.post("/v1/quotations", (req: Request, res: Response) => {
    const idempotencyKey = req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      sendError(
        res,
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header is required",
        { header: "Idempotency-Key" },
      );
      return;
    }

    const fingerprint = requestFingerprint(req);
    const existing = quoteIdempotencyByKey.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        sendError(
          res,
          409,
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key already used with a different request body",
          { idempotency_key: idempotencyKey },
        );
        return;
      }

      res.status(200).json(existing.response);
      return;
    }

    if (!isRecord(req.body)) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Request body must be a JSON object",
      );
      return;
    }

    const sourceAmountRaw = parseAmount(req.body.source_amount);
    const sourceCurrencyRaw = parseNonEmptyString(req.body.source_currency);
    const destCurrencyRaw = parseNonEmptyString(req.body.dest_currency);
    const payerIdRaw = parseNonEmptyString(req.body.payer_id);
    const modeRaw = parseNonEmptyString(req.body.mode);

    if (
      sourceAmountRaw === null ||
      sourceCurrencyRaw === null ||
      destCurrencyRaw === null ||
      payerIdRaw === null ||
      modeRaw === null
    ) {
      sendError(res, 400, "VALIDATION_ERROR", "Missing or invalid fields", {
        required: [
          "source_amount",
          "source_currency",
          "dest_currency",
          "payer_id",
          "mode",
        ],
      });
      return;
    }

    const mode = modeRaw.toUpperCase() as QuoteMode;
    if (mode !== "SOURCE" && mode !== "DEST") {
      sendError(res, 400, "VALIDATION_ERROR", "mode must be SOURCE or DEST", {
        mode: modeRaw,
      });
      return;
    }

    const payer = resolvePayer(payerIdRaw);
    if (!payer) {
      sendError(res, 400, "PAYER_NOT_FOUND", "Unknown payer_id", {
        payer_id: payerIdRaw,
      });
      return;
    }

    const sourceCurrency = normalizeCurrency(sourceCurrencyRaw);
    const destCurrency = normalizeCurrency(destCurrencyRaw);
    if (!payerSupportsPair(payer, sourceCurrency, destCurrency)) {
      sendError(
        res,
        400,
        "UNSUPPORTED_CURRENCY_PAIR",
        "Payer does not support this currency pair",
        {
          payer_id: payer.id,
          source_currency: sourceCurrency,
          dest_currency: destCurrency,
          supported_pairs: payer.currency_pairs,
        },
      );
      return;
    }

    const pairKey = `${sourceCurrency}:${destCurrency}`;
    const fxRate = FX_RATES[pairKey];
    if (!fxRate) {
      sendError(res, 400, "UNSUPPORTED_CURRENCY_PAIR", "No FX rate for pair", {
        source_currency: sourceCurrency,
        dest_currency: destCurrency,
      });
      return;
    }

    if (sourceAmountRaw <= 0) {
      sendError(res, 400, "VALIDATION_ERROR", "source_amount must be > 0", {
        source_amount: sourceAmountRaw,
      });
      return;
    }

    let sourceAmount: number;
    if (mode === "SOURCE") {
      sourceAmount = sourceAmountRaw;
    } else {
      const desiredDestAmount = sourceAmountRaw;
      sourceAmount = (desiredDestAmount / fxRate + FEE_BASE) / (1 - FEE_PCT);
    }

    sourceAmount = round2(sourceAmount);
    if (sourceAmount < payer.min_amount || sourceAmount > payer.max_amount) {
      sendError(res, 400, "AMOUNT_OUT_OF_RANGE", "Amount outside payer limits", {
        min_amount: payer.min_amount,
        max_amount: payer.max_amount,
        source_amount: sourceAmount,
      });
      return;
    }

    const fee = round2(sourceAmount * FEE_PCT + FEE_BASE);
    if (sourceAmount <= fee) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "source_amount must be greater than fee",
        { source_amount: sourceAmount, fee },
      );
      return;
    }

    const destAmount = round2((sourceAmount - fee) * fxRate);
    const now = Date.now();

    const quote: Quote = {
      id: randomUUID(),
      payer_id: payer.id,
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
      dest_currency: destCurrency,
      mode,
      fx_rate: fxRate,
      fee,
      dest_amount: destAmount,
      expires_at: new Date(now + QUOTE_TTL_MS).toISOString(),
      created_at: new Date(now).toISOString(),
    };

    quotesById.set(quote.id, quote);

    const response = quoteResponse(quote);
    quoteIdempotencyByKey.set(idempotencyKey, {
      fingerprint,
      response,
      created_at: quote.created_at,
    });

    res.status(200).json(response);
  });

  app.post("/v1/quotations/:id/transactions", (req: Request, res: Response) => {
    const idempotencyKey = req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      sendError(
        res,
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header is required",
        { header: "Idempotency-Key" },
      );
      return;
    }

    const fingerprint = requestFingerprint(req);
    const existing = transactionIdempotencyByKey.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        sendError(
          res,
          409,
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key already used with a different request body",
          { idempotency_key: idempotencyKey },
        );
        return;
      }

      res.status(201).json(existing.response);
      return;
    }

    const quoteId = req.params.id;
    const quote = quotesById.get(quoteId);
    if (!quote) {
      sendError(res, 404, "QUOTE_NOT_FOUND", "Unknown quotation id", {
        quote_id: quoteId,
      });
      return;
    }

    const expiresAt = Date.parse(quote.expires_at);
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      sendError(res, 400, "QUOTE_EXPIRED", "Quotation has expired", {
        quote_id: quoteId,
        expires_at: quote.expires_at,
      });
      return;
    }

    if (!isRecord(req.body)) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Request body must be a JSON object",
      );
      return;
    }

    const externalIdRaw = parseNonEmptyString(req.body.external_id);
    const sender = parseRecord(req.body.sender);
    const receiver = parseRecord(req.body.receiver);
    const purposeRaw = parseNonEmptyString(req.body.purpose);

    if (!externalIdRaw || !sender || !receiver || !purposeRaw) {
      sendError(res, 400, "VALIDATION_ERROR", "Missing or invalid fields", {
        required: ["external_id", "sender", "receiver", "purpose"],
      });
      return;
    }

    const payer = resolvePayer(quote.payer_id);
    if (!payer) {
      sendError(res, 500, "INTERNAL_ERROR", "Quote references unknown payer", {
        payer_id: quote.payer_id,
      });
      return;
    }

    const missing: string[] = [];
    for (const field of payer.required_fields) {
      const value = getValueAtPath(req.body, field);
      if (!isPresent(value)) missing.push(field);
    }

    if (missing.length > 0) {
      sendError(res, 400, "MISSING_REQUIRED_FIELDS", "Missing required fields", {
        payer_id: payer.id,
        missing_fields: missing,
        required_fields: payer.required_fields,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const transaction: Transaction = {
      id: randomUUID(),
      quote_id: quote.id,
      payer_id: payer.id,
      external_id: externalIdRaw,
      sender,
      receiver,
      purpose: purposeRaw,
      status: "PENDING",
      created_at: nowIso,
      updated_at: nowIso,
    };

    transactionsById.set(transaction.id, transaction);
    transactionIdempotencyByKey.set(idempotencyKey, {
      fingerprint,
      response: JSON.parse(JSON.stringify(transaction)),
      created_at: nowIso,
    });

    res.status(201).json(transaction);
  });

  app.post("/v1/transactions/:id/confirm", (req: Request, res: Response) => {
    const transactionId = req.params.id;
    const transaction = transactionsById.get(transactionId);
    if (!transaction) {
      sendError(res, 404, "TRANSACTION_NOT_FOUND", "Unknown transaction id", {
        transaction_id: transactionId,
      });
      return;
    }

    if (transaction.status === "PENDING") {
      transaction.status = "CONFIRMED";
      transaction.updated_at = new Date().toISOString();
      setTimeout(() => {
        void finalizeTransaction(transactionId);
      }, 500);
    }

    res.status(200).json(transaction);
  });

  app.get("/v1/transactions/:id", (req: Request, res: Response) => {
    const transactionId = req.params.id;
    const transaction = transactionsById.get(transactionId);
    if (!transaction) {
      sendError(res, 404, "TRANSACTION_NOT_FOUND", "Unknown transaction id", {
        transaction_id: transactionId,
      });
      return;
    }
    res.status(200).json(transaction);
  });

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof SyntaxError) {
        res.status(400).json({
          code: "INVALID_JSON",
          message: "Invalid JSON body",
          details: {},
        });
        return;
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Unexpected error",
        details: {},
      });
    },
  );

  return app;
}
