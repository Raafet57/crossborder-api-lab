import { describe, it, expect, beforeEach } from '@jest/globals';
import { RWAMockAdapter } from '@crossborder/network-adapters';

describe('RWAMockAdapter', () => {
  let adapter: RWAMockAdapter;

  beforeEach(() => {
    adapter = new RWAMockAdapter();
  });

  describe('config', () => {
    it('has correct network type', () => {
      expect(adapter.config.type).toBe('tokenized_asset');
    });

    it('supports USD to TBOND', () => {
      expect(adapter.config.supportedCurrencies).toContainEqual({
        source: 'USD',
        dest: 'TBOND',
      });
    });

    it('has higher minimum limits for institutional', () => {
      expect(adapter.config.limits.min).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('getQuote()', () => {
    it('returns quote for treasury bonds', async () => {
      const quote = await adapter.getQuote({
        networkId: 'rwa-treasury',
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        sourceAmount: 100000,
        mode: 'SOURCE',
      });

      expect(quote.destCurrency).toBe('TBOND');
      expect(quote.sourceAmount).toBe(100000);
    });

    it('applies management fee', async () => {
      const quote = await adapter.getQuote({
        networkId: 'rwa-treasury',
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        sourceAmount: 100000,
        mode: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.destAmount).toBeLessThan(quote.sourceAmount);
    });

    it('includes settlement metadata', async () => {
      const quote = await adapter.getQuote({
        networkId: 'rwa-treasury',
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        sourceAmount: 100000,
        mode: 'SOURCE',
      });

      expect(quote.networkMetadata).toHaveProperty('settlementType');
      expect(quote.networkMetadata).toHaveProperty('custodian');
    });
  });

  describe('initiatePayment()', () => {
    it('returns PENDING status when queued', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'rwa-treasury',
        externalId: 'pay_123',
        sourceAmount: 100000,
        sourceCurrency: 'USD',
        destAmount: 99900,
        destCurrency: 'TBOND',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: { walletAddress: '0xCustodyWallet' },
        correlationId: 'corr_123',
      });

      expect(result.status).toBe('PENDING');
      expect(result).toHaveProperty('networkPaymentId');
    });

    it('fails without wallet address', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'rwa-treasury',
        externalId: 'pay_123',
        sourceAmount: 100000,
        sourceCurrency: 'USD',
        destAmount: 99900,
        destCurrency: 'TBOND',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {},
        correlationId: 'corr_123',
      });

      expect(result.status).toBe('FAILED');
    });

    it('includes settlement date in metadata', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'rwa-treasury',
        externalId: 'pay_123',
        sourceAmount: 100000,
        sourceCurrency: 'USD',
        destAmount: 99900,
        destCurrency: 'TBOND',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: { walletAddress: '0xCustodyWallet' },
        correlationId: 'corr_123',
      });

      expect(result.networkMetadata).toHaveProperty('settlementDate');
    });
  });

  describe('getPaymentStatus()', () => {
    it('tracks payment status', async () => {
      const initResult = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'rwa-treasury',
        externalId: 'pay_123',
        sourceAmount: 100000,
        sourceCurrency: 'USD',
        destAmount: 99900,
        destCurrency: 'TBOND',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: { walletAddress: '0xCustodyWallet' },
        correlationId: 'corr_123',
      });

      const status = await adapter.getPaymentStatus(initResult.networkPaymentId);
      expect(['PENDING', 'COMPLETED']).toContain(status.status);
    });
  });
});
