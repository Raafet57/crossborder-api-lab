import { describe, it, expect, beforeEach } from '@jest/globals';
import { MPesaAdapter, GCashAdapter } from '@crossborder/network-adapters';

describe('MPesaAdapter', () => {
  let adapter: MPesaAdapter;

  beforeEach(() => {
    adapter = new MPesaAdapter({
      simulatedDelayMs: 100,
      failureRate: 0,
    });
  });

  describe('getQuote()', () => {
    it('returns quote with M-Pesa fees', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.destCurrency).toBe('KES');
    });

    it('converts USD to KES', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote.fxRate).toBeGreaterThan(100); // KES is weaker than USD
      expect(quote.destAmount).toBeGreaterThan(quote.sourceAmount);
    });
  });

  describe('initiatePayment()', () => {
    it('simulates STK push initiation', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'KES',
        phone: '+254700123456',
      });

      expect(result.status).toBe('PENDING_USER_ACTION');
    });

    it('returns pending status', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'KES',
        phone: '+254700123456',
      });

      expect(result).toHaveProperty('networkPaymentId');
    });
  });

  describe('simulateCallback()', () => {
    it('simulates successful callback after delay', async () => {
      const callbackPromise = adapter.waitForCallback('pay_123');

      // Trigger the simulation
      adapter.simulateUserConfirmation('pay_123', true);

      const result = await callbackPromise;
      expect(result.status).toBe('CONFIRMED');
    });

    it('simulates timeout after 60 seconds', async () => {
      // This test would use a shorter timeout for testing
      const shortAdapter = new MPesaAdapter({
        simulatedDelayMs: 50,
        timeoutMs: 100,
        failureRate: 0,
      });

      const result = await shortAdapter.waitForCallback('pay_timeout');
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('timeout');
    }, 10000);
  });
});

describe('GCashAdapter', () => {
  let adapter: GCashAdapter;

  beforeEach(() => {
    adapter = new GCashAdapter({
      simulatedDelayMs: 100,
      failureRate: 0,
    });
  });

  it('returns quote with GCash fees', async () => {
    const quote = await adapter.getQuote({
      sourceCurrency: 'USD',
      destCurrency: 'PHP',
      amount: 100,
      amountType: 'SOURCE',
    });

    expect(quote.fee).toBeGreaterThan(0);
    expect(quote.destCurrency).toBe('PHP');
  });

  it('converts USD to PHP', async () => {
    const quote = await adapter.getQuote({
      sourceCurrency: 'USD',
      destCurrency: 'PHP',
      amount: 100,
      amountType: 'SOURCE',
    });

    expect(quote.fxRate).toBeGreaterThan(50); // PHP is weaker than USD
  });
});
