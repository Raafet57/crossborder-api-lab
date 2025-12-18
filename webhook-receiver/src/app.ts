import { createHmac, timingSafeEqual } from "crypto";
import express, { Request, Response } from "express";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "whsec_demo";

type WebhookEvent = Record<string, unknown>;

const latestEventByTxId = new Map<string, WebhookEvent>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTransactionId(event: WebhookEvent): string | null {
  const data = event.data;
  if (!isRecord(data)) return null;
  const transaction = data.transaction;
  if (!isRecord(transaction)) return null;
  const txId = transaction.id;
  return typeof txId === "string" && txId.trim() !== "" ? txId : null;
}

function safeEqualHex(a: string, b: string): boolean {
  const isValidHex = (value: string) =>
    /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0;

  if (!isValidHex(a) || !isValidHex(b)) return false;

  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;

  return timingSafeEqual(aBuf, bBuf);
}

export function createApp() {
  const app = express();

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.post(
    "/webhooks/thunes",
    express.raw({ type: "*/*" }),
    (req: Request, res: Response) => {
      const signature = req.header("X-Sig");
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

      const computed = createHmac("sha256", WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (typeof signature !== "string" || !safeEqualHex(signature, computed)) {
        res.status(400).json({ code: "BAD_SIGNATURE" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody.toString("utf8"));
      } catch {
        res.status(400).json({ code: "INVALID_JSON" });
        return;
      }

      if (!isRecord(parsed)) {
        res.status(400).json({ code: "INVALID_EVENT" });
        return;
      }

      const txId = readTransactionId(parsed);
      if (!txId) {
        res.status(400).json({ code: "MISSING_TRANSACTION_ID" });
        return;
      }

      latestEventByTxId.set(txId, parsed);
      res.status(200).json({ status: "ok" });
    },
  );

  app.get("/events/:txId", (req: Request, res: Response) => {
    const txId = req.params.txId;
    const event = latestEventByTxId.get(txId);
    if (!event) {
      res.status(404).json({ code: "NOT_FOUND" });
      return;
    }

    res.status(200).json(event);
  });

  return app;
}

