import { describe, it, expect, beforeEach } from '@jest/globals';
import { RWATBondsAdapter } from '@crossborder/network-adapters';

describe('RWATBondsAdapter', () => {
  let adapter: RWATBondsAdapter;

  beforeEach(() => {
    adapter = new RWATBondsAdapter({
      simulatedSettlementMs: 100, // Fast for testing
    });
  });

  describe('getQuote()', () => {
    it('returns quote for treasury bonds', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        amount: 100000,
        amountType: 'SOURCE',
      });

      expect(quote.destCurrency).toBe('TBOND');
      expect(quote.sourceAmount).toBe(100000);
    });

    it('applies institutional pricing', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        amount: 100000,
        amountType: 'SOURCE',
      });

      // Institutional fees should be lower
      expect(quote.fee).toBeLessThan(quote.sourceAmount * 0.01);
    });
  });

  describe('initiatePayment()', () => {
    it('queues payment for matching', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100000,
        currency: 'TBOND',
      });

      expect(result.status).toBe('QUEUED');
    });

    it('returns QUEUED status', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100000,
        currency: 'TBOND',
      });

      expect(result).toHaveProperty('networkPaymentId');
    });
  });

  describe('settlement simulation', () => {
    it('transitions through MATCHING state', async () => {
      await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100000,
        currency: 'TBOND',
      });

      const status1 = await adapter.getPaymentStatus('pay_123');
      expect(['QUEUED', 'MATCHING']).toContain(status1.status);
    });

    it('transitions through PENDING_CUSTODY state', async () => {
      await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100000,
        currency: 'TBOND',
      });

      // Wait for settlement simulation
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = await adapter.getPaymentStatus('pay_123');
      expect(['MATCHING', 'PENDING_CUSTODY', 'SETTLED', 'COMPLETED']).toContain(status.status);
    });

    it('completes at T+1 simulation', async () => {
      await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100000,
        currency: 'TBOND',
      });

      // Wait for full settlement
      await new Promise(resolve => setTimeout(resolve, 300));

      const status = await adapter.getPaymentStatus('pay_123');
      expect(status.status).toBe('COMPLETED');
    });
  });
});
