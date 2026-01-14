import { describe, it, expect, beforeEach } from '@jest/globals';
import { MPesaMockAdapter, GCashMockAdapter } from '@crossborder/network-adapters';

describe('MPesaMockAdapter', () => {
  let adapter: MPesaMockAdapter;

  beforeEach(() => {
    adapter = new MPesaMockAdapter();
  });

  describe('config', () => {
    it('has correct network type', () => {
      expect(adapter.config.type).toBe('mobile_wallet');
    });

    it('supports USD to KES', () => {
      expect(adapter.config.supportedCurrencies).toContainEqual({
        source: 'USD',
        dest: 'KES',
      });
    });

    it('requires receiver phone', () => {
      const phoneField = adapter.config.requiredFields.find(
        f => f.path === 'receiver.phone'
      );
      expect(phoneField).toBeDefined();
    });
  });

  describe('getQuote()', () => {
    it('returns quote with M-Pesa fees', async () => {
      const quote = await adapter.getQuote({
        networkId: 'mpesa-kenya',
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        sourceAmount: 100,
        mode: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.destCurrency).toBe('KES');
    });

    it('converts USD to KES with proper rate', async () => {
      const quote = await adapter.getQuote({
        networkId: 'mpesa-kenya',
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        sourceAmount: 100,
        mode: 'SOURCE',
      });

      expect(quote.fxRate).toBeGreaterThan(100);
      expect(quote.destAmount).toBeGreaterThan(quote.sourceAmount);
    });

    it('includes provider metadata', async () => {
      const quote = await adapter.getQuote({
        networkId: 'mpesa-kenya',
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        sourceAmount: 100,
        mode: 'SOURCE',
      });

      expect(quote.networkMetadata).toHaveProperty('provider');
      expect(quote.networkMetadata).toHaveProperty('corridor');
    });
  });

  describe('initiatePayment()', () => {
    it('returns PENDING status for valid Kenyan phone', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'mpesa-kenya',
        externalId: 'pay_123',
        sourceAmount: 100,
        sourceCurrency: 'USD',
        destAmount: 15000,
        destCurrency: 'KES',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+254700123456',
        },
        correlationId: 'corr_123',
      });

      expect(result.status).toBe('PENDING');
      expect(result).toHaveProperty('networkPaymentId');
    });

    it('fails with invalid phone number', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'mpesa-kenya',
        externalId: 'pay_123',
        sourceAmount: 100,
        sourceCurrency: 'USD',
        destAmount: 15000,
        destCurrency: 'KES',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890', // Not Kenyan
        },
        correlationId: 'corr_123',
      });

      expect(result.status).toBe('FAILED');
    });

    it('includes conversation IDs in metadata', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'mpesa-kenya',
        externalId: 'pay_123',
        sourceAmount: 100,
        sourceCurrency: 'USD',
        destAmount: 15000,
        destCurrency: 'KES',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+254700123456',
        },
        correlationId: 'corr_123',
      });

      expect(result.networkMetadata).toHaveProperty('conversationId');
      expect(result.networkMetadata).toHaveProperty('originatorConversationId');
    });
  });

  describe('getPaymentStatus()', () => {
    it('tracks payment status', async () => {
      const initResult = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'mpesa-kenya',
        externalId: 'pay_123',
        sourceAmount: 100,
        sourceCurrency: 'USD',
        destAmount: 15000,
        destCurrency: 'KES',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+254700123456',
        },
        correlationId: 'corr_123',
      });

      const status = await adapter.getPaymentStatus(initResult.networkPaymentId);
      expect(['PENDING', 'COMPLETED', 'FAILED']).toContain(status.status);
    });
  });
});

describe('GCashMockAdapter', () => {
  let adapter: GCashMockAdapter;

  beforeEach(() => {
    adapter = new GCashMockAdapter();
  });

  describe('config', () => {
    it('has correct network type', () => {
      expect(adapter.config.type).toBe('mobile_wallet');
    });

    it('supports USD to PHP', () => {
      expect(adapter.config.supportedCurrencies).toContainEqual({
        source: 'USD',
        dest: 'PHP',
      });
    });
  });

  describe('getQuote()', () => {
    it('returns quote with GCash fees', async () => {
      const quote = await adapter.getQuote({
        networkId: 'gcash-ph',
        sourceCurrency: 'USD',
        destCurrency: 'PHP',
        sourceAmount: 100,
        mode: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.destCurrency).toBe('PHP');
    });

    it('converts USD to PHP', async () => {
      const quote = await adapter.getQuote({
        networkId: 'gcash-ph',
        sourceCurrency: 'USD',
        destCurrency: 'PHP',
        sourceAmount: 100,
        mode: 'SOURCE',
      });

      expect(quote.fxRate).toBeGreaterThan(50);
    });
  });

  describe('initiatePayment()', () => {
    it('returns PENDING status for valid Philippine phone', async () => {
      const result = await adapter.initiatePayment({
        quoteId: 'quote_123',
        networkId: 'gcash-ph',
        externalId: 'pay_123',
        sourceAmount: 100,
        sourceCurrency: 'USD',
        destAmount: 5500,
        destCurrency: 'PHP',
        sender: { firstName: 'John', lastName: 'Doe' },
        receiver: {
          firstName: 'Maria',
          lastName: 'Santos',
          phone: '+639171234567',
        },
        correlationId: 'corr_123',
      });

      expect(result.status).toBe('PENDING');
    });
  });
});
