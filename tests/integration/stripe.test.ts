import { describe, it, expect, beforeAll } from '@jest/globals';
import { StripeAdapter } from '@crossborder/network-adapters';

const SKIP_STRIPE = !process.env.STRIPE_SECRET_KEY;

describe('Stripe Integration', () => {
  let adapter: StripeAdapter;

  beforeAll(() => {
    if (!SKIP_STRIPE) {
      adapter = new StripeAdapter({
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test',
      });
    }
  });

  (SKIP_STRIPE ? describe.skip : describe)('real Stripe API', () => {
    it('creates PaymentIntent with test card', async () => {
      const result = await adapter.initiatePayment({
        paymentId: `test_${Date.now()}`,
        amount: 1000, // $10.00
        currency: 'USD',
      });

      expect(result.networkPaymentId).toMatch(/^pi_/);
      expect(result.clientSecret).toBeTruthy();
    });

    it('retrieves PaymentIntent status', async () => {
      const result = await adapter.initiatePayment({
        paymentId: `test_${Date.now()}`,
        amount: 500,
        currency: 'USD',
      });

      const status = await adapter.getPaymentStatus(result.networkPaymentId!);
      expect(['requires_confirmation', 'requires_payment_method']).toContain(status.status);
    });

    it('gets quote with real Stripe fees', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USD',
        amount: 100,
        amountType: 'SOURCE',
      });

      // Stripe typically charges 2.9% + $0.30
      expect(quote.fee).toBeGreaterThan(3);
      expect(quote.fee).toBeLessThan(5);
    });
  });
});
