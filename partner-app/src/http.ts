import { randomUUID } from "crypto";
import { AUTH_KEY } from "./config";

export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  url: string;
  idempotencyKey?: string;
  body?: unknown;
};

export async function requestJson<T>(options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${AUTH_KEY}`,
    "X-Correlation-Id": randomUUID(),
  };

  if (options.method === "POST") {
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(options.url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await res.text();
  const parsedBody = rawText ? safeJsonParse(rawText) : null;

  if (!res.ok) {
    const statusLine = `${res.status} ${res.statusText}`.trim();
    throw new HttpError(res.status, statusLine, parsedBody);
  }

  return parsedBody as T;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}
