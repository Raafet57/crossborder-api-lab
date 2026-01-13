import { describe, it, expect, beforeEach } from '@jest/globals';
import { IdempotencyService } from '@crossborder/core';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  it('generates consistent fingerprint for same input', () => {
    const body1 = { amount: 100, currency: 'USD' };
    const body2 = { amount: 100, currency: 'USD' };

    const fp1 = service.generateFingerprint(body1);
    const fp2 = service.generateFingerprint(body2);

    expect(fp1).toBe(fp2);
  });

  it('generates different fingerprint for different input', () => {
    const body1 = { amount: 100, currency: 'USD' };
    const body2 = { amount: 200, currency: 'USD' };

    const fp1 = service.generateFingerprint(body1);
    const fp2 = service.generateFingerprint(body2);

    expect(fp1).not.toBe(fp2);
  });

  it('stores and retrieves cached responses', async () => {
    const key = 'idemp_123';
    const response = { id: 'pay_123', status: 'CREATED' };

    await service.store(key, response);
    const cached = await service.get(key);

    expect(cached).toEqual(response);
  });

  it('returns null for cache miss', async () => {
    const cached = await service.get('non_existent_key');
    expect(cached).toBeNull();
  });

  it('respects TTL expiration', async () => {
    const shortTTLService = new IdempotencyService({ ttlMs: 50 });
    const key = 'idemp_ttl';
    const response = { id: 'pay_123' };

    await shortTTLService.store(key, response);

    // Should exist immediately
    expect(await shortTTLService.get(key)).toEqual(response);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(await shortTTLService.get(key)).toBeNull();
  });

  it('handles concurrent requests with same key', async () => {
    const key = 'idemp_concurrent';
    const response = { id: 'pay_123' };

    // Simulate concurrent check-and-set
    const [result1, result2] = await Promise.all([
      service.checkAndSet(key, () => Promise.resolve(response)),
      service.checkAndSet(key, () => Promise.resolve({ id: 'pay_456' })),
    ]);

    // Both should return the same response (first one wins)
    expect(result1.id).toBe(result2.id);
  });
});
