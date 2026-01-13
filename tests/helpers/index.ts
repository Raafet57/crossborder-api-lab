import type { Payment, Quote, Network, Payer, PaymentEvent } from '@crossborder/core';
import { PaymentStatus, NetworkType } from '@crossborder/core';
import { jest } from '@jest/globals';

export function createMockNetwork(overrides: Partial<Network> = {}): Network {
  return {
    id: 'test-network',
    name: 'Test Network',
    type: NetworkType.STABLECOIN,
    supportedCurrencies: ['USD', 'USDC'],
    enabled: true,
    ...overrides,
  };
}

export function createMockPayer(overrides: Partial<Payer> = {}): Payer {
  return {
    id: 'test-payer',
    networkId: 'test-network',
    name: 'Test Payer',
    country: 'US',
    currency: 'USD',
    requiredFields: ['walletAddress'],
    minAmount: 1,
    maxAmount: 100000,
    ...overrides,
  };
}

export function createMockQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: `quote_${Date.now()}`,
    networkId: 'test-network',
    sourceCurrency: 'USD',
    destCurrency: 'USDC',
    sourceAmount: 100,
    destAmount: 99.5,
    fxRate: 1.0,
    fee: 0.5,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: `pay_${Date.now()}`,
    quoteId: 'quote_123',
    networkId: 'test-network',
    payerId: 'test-payer',
    externalId: 'ext_123',
    status: PaymentStatus.CREATED,
    sourceAmount: 100,
    destAmount: 99.5,
    sourceCurrency: 'USD',
    destCurrency: 'USDC',
    sender: { firstName: 'John', lastName: 'Doe' },
    receiver: { firstName: 'Jane', lastName: 'Smith', walletAddress: '0x123' },
    purpose: 'PAYMENT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockPaymentEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    id: `evt_${Date.now()}`,
    paymentId: 'pay_123',
    type: 'payment.created',
    timestamp: new Date().toISOString(),
    data: {},
    correlationId: 'corr_123',
    ...overrides,
  };
}

export async function waitFor(
  conditionFn: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

export function createMockNetworkAdapter(overrides: Record<string, unknown> = {}) {
  return {
    config: createMockNetwork(),
    getQuote: jest.fn().mockResolvedValue(createMockQuote()),
    initiatePayment: jest.fn().mockResolvedValue({
      paymentId: 'pay_123',
      networkPaymentId: 'net_123',
      status: PaymentStatus.SUBMITTED
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      status: PaymentStatus.CONFIRMED
    }),
    getPaymentStatus: jest.fn().mockResolvedValue({
      status: PaymentStatus.COMPLETED
    }),
    parseWebhook: jest.fn().mockResolvedValue({
      type: 'payment.completed',
      data: {}
    }),
    ...overrides,
  };
}
