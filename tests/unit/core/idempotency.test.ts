import { describe, it, expect } from '@jest/globals';
import { createFingerprint, normalizeForHashing } from '@crossborder/core';

describe('Idempotency Utils', () => {
  describe('createFingerprint()', () => {
    it('generates consistent fingerprint for same input', () => {
      const body1 = { amount: 100, currency: 'USD' };
      const body2 = { amount: 100, currency: 'USD' };

      const fp1 = createFingerprint(body1);
      const fp2 = createFingerprint(body2);

      expect(fp1).toBe(fp2);
    });

    it('generates different fingerprint for different input', () => {
      const body1 = { amount: 100, currency: 'USD' };
      const body2 = { amount: 200, currency: 'USD' };

      const fp1 = createFingerprint(body1);
      const fp2 = createFingerprint(body2);

      expect(fp1).not.toBe(fp2);
    });

    it('generates consistent fingerprint regardless of key order', () => {
      const body1 = { amount: 100, currency: 'USD' };
      const body2 = { currency: 'USD', amount: 100 };

      const fp1 = createFingerprint(body1);
      const fp2 = createFingerprint(body2);

      expect(fp1).toBe(fp2);
    });

    it('returns SHA256 hex string', () => {
      const fp = createFingerprint({ test: 'data' });

      expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('normalizeForHashing()', () => {
    it('sorts object keys alphabetically', () => {
      const input = { z: 1, a: 2, m: 3 };
      const normalized = normalizeForHashing(input);

      expect(normalized).toBe('{"a":2,"m":3,"z":1}');
    });

    it('handles nested objects', () => {
      const input = { outer: { z: 1, a: 2 } };
      const normalized = normalizeForHashing(input);

      expect(normalized).toBe('{"outer":{"a":2,"z":1}}');
    });

    it('handles arrays', () => {
      const input = { items: [{ b: 2 }, { a: 1 }] };
      const normalized = normalizeForHashing(input);

      expect(normalized).toBe('{"items":[{"b":2},{"a":1}]}');
    });

    it('handles null values', () => {
      const input = { value: null };
      const normalized = normalizeForHashing(input);

      expect(normalized).toBe('{"value":null}');
    });
  });
});
