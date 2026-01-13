import { describe, it, expect, beforeAll } from '@jest/globals';
import { CrossBorderClient } from '@crossborder/sdk';

describe('E2E Happy Paths', () => {
  let client: CrossBorderClient;

  beforeAll(() => {
    client = new CrossBorderClient({
      apiKey: 'test_key',
      baseUrl: process.env.API_URL || 'http://localhost:4000',
      webhookBaseUrl: process.env.WEBHOOK_URL || 'http://localhost:4002',
    });
  });

  describe('Stablecoin Payment', () => {
    it('completes USD -> USDC payment flow', async () => {
      // 1. List networks
      const networks = await client.networks.list();
      expect(networks.length).toBeGreaterThan(0);

      // 2. Get payers for polygon-usdc
      const payers = await client.networks.listPayers('polygon-usdc');
      expect(payers.length).toBeGreaterThan(0);

      // 3. Create quote
      const quote = await client.quotes.create({
        networkId: 'polygon-usdc',
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      });
      expect(quote.id).toBeTruthy();
      expect(quote.destAmount).toBeGreaterThan(0);

      // 4. Create payment
      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: payers[0].id,
        sender: { firstName: 'E2E', lastName: 'Test' },
        receiver: { firstName: 'Recipient', lastName: 'Test', walletAddress: '0x1234' },
      });
      expect(payment.id).toBeTruthy();
      expect(payment.status).toBe('CREATED');

      // 5. Confirm payment
      const confirmed = await client.payments.confirm(payment.id);
      expect(['SUBMITTED', 'CONFIRMED', 'COMPLETED']).toContain(confirmed.status);

      // 6. Check events
      const events = await client.payments.listEvents(payment.id);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'payment.created')).toBe(true);
    });
  });

  describe('Card Payment', () => {
    it('completes card payment flow', async () => {
      const quote = await client.quotes.create({
        networkId: 'stripe',
        sourceCurrency: 'USD',
        destCurrency: 'USD',
        amount: 50,
        amountType: 'SOURCE',
      });

      const payers = await client.networks.listPayers('stripe');

      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: payers[0].id,
        sender: { firstName: 'Card', lastName: 'Test', email: 'test@example.com' },
        receiver: { firstName: 'Merchant', lastName: 'Account' },
      });

      const confirmed = await client.payments.confirm(payment.id);
      expect(['PROCESSING', 'CONFIRMED', 'REQUIRES_ACTION']).toContain(confirmed.status);
    });
  });

  describe('Mobile Wallet Payment', () => {
    it('completes M-Pesa payment with simulated callback', async () => {
      const quote = await client.quotes.create({
        networkId: 'mpesa',
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        amount: 25,
        amountType: 'SOURCE',
      });

      const payers = await client.networks.listPayers('mpesa');

      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: payers[0].id,
        sender: { firstName: 'Mobile', lastName: 'Test' },
        receiver: { firstName: 'Recipient', lastName: 'Test', phone: '+254700123456' },
      });

      const confirmed = await client.payments.confirm(payment.id);
      expect(['SUBMITTED', 'PENDING_USER_ACTION', 'CONFIRMED']).toContain(confirmed.status);
    });
  });

  describe('Tokenized Asset Payment', () => {
    it('completes RWA T+1 settlement', async () => {
      const quote = await client.quotes.create({
        networkId: 'rwa-tbonds',
        sourceCurrency: 'USD',
        destCurrency: 'TBOND',
        amount: 10000,
        amountType: 'SOURCE',
      });

      const payers = await client.networks.listPayers('rwa-tbonds');

      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: payers[0].id,
        sender: { firstName: 'Institution', lastName: 'Treasury' },
        receiver: { firstName: 'Custody', lastName: 'Account', walletAddress: 'custody_001' },
        purpose: 'INVESTMENT',
      });

      const confirmed = await client.payments.confirm(payment.id);
      expect(['QUEUED', 'MATCHING', 'PENDING_CUSTODY']).toContain(confirmed.status);
    });
  });
});
