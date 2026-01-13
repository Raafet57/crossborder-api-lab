import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../types/errors';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const minuteStore = new Map<string, RateLimitEntry>();
const dayStore = new Map<string, RateLimitEntry>();

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const clientId = req.auth?.clientId || 'anonymous';
    const limits = req.auth?.rateLimit || { requestsPerMinute: 30, requestsPerDay: 500 };
    const now = Date.now();

    const minuteKey = `${clientId}:minute`;
    const minuteEntry = minuteStore.get(minuteKey);

    if (minuteEntry && now < minuteEntry.resetAt) {
      if (minuteEntry.count >= limits.requestsPerMinute) {
        const retryAfter = Math.ceil((minuteEntry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', limits.requestsPerMinute);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(minuteEntry.resetAt / 1000));
        throw new AppError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded', { retryAfter });
      }
      minuteEntry.count++;
    } else {
      minuteStore.set(minuteKey, { count: 1, resetAt: now + 60000 });
    }

    const dayKey = `${clientId}:day`;
    const dayEntry = dayStore.get(dayKey);

    if (dayEntry && now < dayEntry.resetAt) {
      if (dayEntry.count >= limits.requestsPerDay) {
        const retryAfter = Math.ceil((dayEntry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        throw new AppError(ErrorCode.RATE_LIMITED, 'Daily rate limit exceeded', { retryAfter });
      }
      dayEntry.count++;
    } else {
      dayStore.set(dayKey, { count: 1, resetAt: now + 86400000 });
    }

    const currentMinute = minuteStore.get(minuteKey)!;
    res.setHeader('X-RateLimit-Limit', limits.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.requestsPerMinute - currentMinute.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(currentMinute.resetAt / 1000));

    next();
  } catch (error) {
    next(error);
  }
}

export function cleanupRateLimits(): void {
  const now = Date.now();

  for (const [key, entry] of minuteStore.entries()) {
    if (now >= entry.resetAt) minuteStore.delete(key);
  }

  for (const [key, entry] of dayStore.entries()) {
    if (now >= entry.resetAt) dayStore.delete(key);
  }
}

setInterval(cleanupRateLimits, 60000);
