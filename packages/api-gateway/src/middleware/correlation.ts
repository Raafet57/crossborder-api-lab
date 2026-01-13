import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, isValidCorrelationId } from '@crossborder/core';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  let correlationId = req.headers['x-correlation-id'] as string;

  if (!correlationId || !isValidCorrelationId(correlationId)) {
    correlationId = generateCorrelationId();
  }

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
