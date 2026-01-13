import { Request, Response, NextFunction } from 'express';
import { hmacSha256 } from '@crossborder/core';
import { config } from '../config';
import { AppError, ErrorCode } from '../types/errors';
import { timingSafeEqual } from 'crypto';

export function signatureMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!shouldValidateSignature(req)) {
      return next();
    }

    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !timestamp) {
      throw new AppError(
        ErrorCode.INVALID_SIGNATURE,
        'Missing signature headers (X-Signature, X-Timestamp)'
      );
    }

    const timestampMs = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (isNaN(timestampMs) || Math.abs(now - timestampMs) > fiveMinutes) {
      throw new AppError(
        ErrorCode.INVALID_SIGNATURE,
        'Signature timestamp expired or invalid'
      );
    }

    const bodyString = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});

    const payload = `${timestamp}.${req.method}.${req.originalUrl}.${bodyString}`;
    const expectedSignature = hmacSha256(payload, config.signatureSecret);

    if (!timingSafeCompare(signature, expectedSignature)) {
      throw new AppError(ErrorCode.INVALID_SIGNATURE, 'Invalid signature');
    }

    next();
  } catch (error) {
    next(error);
  }
}

function shouldValidateSignature(req: Request): boolean {
  if (!req.path.includes('/payments')) {
    return false;
  }

  if (req.method !== 'POST') {
    return false;
  }

  if (req.path === '/v1/payments' && req.body?.sourceAmount) {
    return req.body.sourceAmount >= config.signatureThreshold;
  }

  return false;
}

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      return false;
    }

    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
