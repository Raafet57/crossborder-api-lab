import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PolygonUSDCAdapter } from '@crossborder/network-adapters';

// Mock ethers
jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
    getGasPrice: jest.fn().mockResolvedValue(BigInt(20000000000)),
    getTransactionReceipt: jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 100,
      confirmations: 3,
    }),
  })),
  Contract: jest.fn().mockImplementation(() => ({
    transfer: jest.fn().mockResolvedValue({
      hash: '0xabc123',
      wait: jest.fn().mockResolvedValue({ status: 1 }),
    }),
    balanceOf: jest.fn().mockResolvedValue(BigInt(1000000000)),
  })),
  Wallet: jest.fn().mockImplementation(() => ({
    address: '0x1234567890abcdef',
    connect: jest.fn().mockReturnThis(),
  })),
  parseUnits: jest.fn((val) => BigInt(val * 1000000)),
  formatUnits: jest.fn((val) => String(Number(val) / 1000000)),
}));

describe('PolygonUSDCAdapter', () => {
  let adapter: PolygonUSDCAdapter;

  beforeEach(() => {
    adapter = new PolygonUSDCAdapter({
      rpcUrl: 'https://rpc-amoy.polygon.technology',
      privateKey: '0x' + '1'.repeat(64),
      usdcAddress: '0xUSDC',
    });
  });

  describe('getQuote()', () => {
    it('returns quote with gas fee estimate', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote).toHaveProperty('sourceAmount');
      expect(quote).toHaveProperty('destAmount');
      expect(quote).toHaveProperty('fee');
      expect(quote.fee).toBeGreaterThan(0);
    });

    it('calculates correct destAmount for SOURCE mode', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      });

      expect(quote.sourceAmount).toBe(100);
      expect(quote.destAmount).toBeLessThan(100); // After fees
    });

    it('sets expiration time', async () => {
      const quote = await adapter.getQuote({
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      });

      const expiresAt = new Date(quote.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('initiatePayment()', () => {
    it('builds and sends transaction', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'USDC',
        recipient: '0xrecipient',
      });

      expect(result).toHaveProperty('networkPaymentId');
      expect(result.networkPaymentId).toMatch(/^0x/);
    });

    it('returns transaction hash', async () => {
      const result = await adapter.initiatePayment({
        paymentId: 'pay_123',
        amount: 100,
        currency: 'USDC',
        recipient: '0xrecipient',
      });

      expect(result.networkPaymentId).toBe('0xabc123');
    });
  });

  describe('getPaymentStatus()', () => {
    it('returns CONFIRMED after N confirmations', async () => {
      const status = await adapter.getPaymentStatus('0xabc123');
      expect(status.status).toBe('CONFIRMED');
    });
  });
});
