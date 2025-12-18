import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const headerValue = req.header("X-Correlation-Id");
  const correlationId =
    typeof headerValue === "string" && headerValue.trim() !== ""
      ? headerValue
      : randomUUID();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}
