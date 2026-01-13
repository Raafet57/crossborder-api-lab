import { describe, it, expect, beforeAll } from '@jest/globals';
import { PolygonUSDCAdapter } from '@crossborder/network-adapters';

const SKIP_POLYGON = !process.env.POLYGON_RPC_URL || !process.env.POLYGON_PRIVATE_KEY;

describe('Polygon Amoy Integration', () => {
  let adapter: PolygonUSDCAdapter;

  beforeAll(() => {
    if (!SKIP_POLYGON) {
      adapter = new PolygonUSDCAdapter({
        rpcUrl: process.env.POLYGON_RPC_URL!,
        privateKey: process.env.POLYGON_PRIVATE_KEY!,
        usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy USDC
      });
    }
  });

  (SKIP_POLYGON ? describe.skip : describe)('real testnet', () => {
    it('connects to Amoy RPC', async () => {
      const status = await adapter.healthCheck();
      expect(status.connected).toBe(true);
      expect(status.chainId).toBe(80002); // Amoy chain ID
    });

    it('estimates gas for USDC transfer', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 10,
        amountType: 'SOURCE',
      });

      expect(quote.fee).toBeGreaterThan(0);
      expect(quote.fee).toBeLessThan(1); // Gas should be cheap on testnet
    });

    it('checks wallet balance', async () => {
      const balance = await adapter.getBalance();
      expect(balance).toHaveProperty('matic');
      expect(balance).toHaveProperty('usdc');
    });

    // Note: Actual transaction tests are skipped to conserve testnet funds
    it.skip('sends USDC transaction', async () => {
      const result = await adapter.initiatePayment({
        paymentId: `test_${Date.now()}`,
        amount: 1,
        currency: 'USDC',
        recipient: '0x0000000000000000000000000000000000000001',
      });

      expect(result.networkPaymentId).toMatch(/^0x/);
    });
  });
});
