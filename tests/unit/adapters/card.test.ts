import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StripeAdapter } from '@crossborder/network-adapters';

// Mock Stripe SDK
const mockStripe = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret',
      status: 'requires_confirmation',
    }),
    confirm: jest.fn().mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    }),
  },
  webhooks: {
    constructEvent: jest.fn().mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    }),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

describe('StripeAdapter', () => {
  let adapter: StripeAdapter;

  beforeEach(() => {
    adapter = new StripeAdapter({
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123',
    });
    jest.clearAllMocks();
  });

  describe('getQuote()', () => {
    it('returns quote with Stripe fees', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USD',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.fxRate).toBe(1.0); // Same currency
    });

    it('supports multiple currencies', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'EUR',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote).toHaveProperty('fxRate');
    });
  });

  describe('initiatePayment()', () => {
    it('creates PaymentIntent', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'USD',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalled();
      expect(result).toHaveProperty('networkPaymentId', 'pi_123');
    });

    it('returns client_secret for frontend', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'USD',
      });

      expect(result).toHaveProperty('clientSecret', 'pi_123_secret');
    });
  });

  describe('confirmPayment()', () => {
    it('confirms PaymentIntent', async () => {
      const result = await adapter.confirmPayment('pi_123');

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith('pi_123');
      expect(result.status).toBe('CONFIRMED');
    });

    it('handles requires_action status for 3DS', async () => {
      mockStripe.paymentIntents.confirm.mockResolvedValueOnce({
        id: 'pi_123',
        status: 'requires_action',
        next_action: { redirect_to_url: { url: 'https://stripe.com/3ds' } },
      });

      const result = await adapter.confirmPayment('pi_123');
      expect(result.status).toBe('REQUIRES_ACTION');
      expect(result).toHaveProperty('redirectUrl');
    });
  });

  describe('parseWebhook()', () => {
    it('verifies webhook signature', async () => {
      const event = await adapter.parseWebhook(
        Buffer.from('{}'),
        { 'stripe-signature': 'sig_123' }
      );

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
      expect(event).toHaveProperty('type', 'payment_intent.succeeded');
    });

    it('rejects invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        adapter.parseWebhook(Buffer.from('{}'), { 'stripe-signature': 'invalid' })
      ).rejects.toThrow();
    });
  });
});
