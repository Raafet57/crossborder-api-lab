import { NextFunction, Request, Response } from "express";

const WINDOW_MS = 1000;
const LIMIT = 5;

type Bucket = {
  windowStartMs: number;
  count: number;
};

const bucketsByIp = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  const ip = getClientIp(req);
  const existing = bucketsByIp.get(ip);

  if (!existing || now - existing.windowStartMs >= WINDOW_MS) {
    bucketsByIp.set(ip, { windowStartMs: now, count: 1 });
    next();
    return;
  }

  existing.count += 1;
  if (existing.count > LIMIT) {
    const remainingMs = existing.windowStartMs + WINDOW_MS - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many requests",
      details: { limit: LIMIT, window_ms: WINDOW_MS },
    });
    return;
  }

  next();
}

