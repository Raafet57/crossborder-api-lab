import { NetworkConfig } from '@crossborder/core';
import {
  BaseMockAdapter,
  QuoteRequest,
  NetworkQuote,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentConfirmationResult,
} from '../../interface';

// FX rate: 1 USD = ~56 PHP (simulated)
const USD_PHP_RATE = 56.15;
const FEE_PERCENT = 0.02; // 2% fee

export class GCashMockAdapter extends BaseMockAdapter {
  readonly config: NetworkConfig = {
    id: 'gcash-ph',
    type: 'mobile_wallet',
    displayName: 'GCash Philippines',
    supportedCurrencies: [
      { source: 'USD', dest: 'PHP' },
    ],
    requiredFields: [
      { path: 'receiver.phone', type: 'string', description: 'Recipient phone number (+63...)' },
      { path: 'receiver.firstName', type: 'string', description: 'Recipient first name' },
      { path: 'receiver.lastName', type: 'string', description: 'Recipient last name' },
    ],
    limits: { min: 1, max: 2000 }, // USD limits
  };

  async getQuote(request: QuoteRequest): Promise<NetworkQuote> {
    await this.simulateDelay(50, 150);

    const fee = request.sourceAmount * FEE_PERCENT;
    const netAmount = request.sourceAmount - fee;
    const destAmount = netAmount * USD_PHP_RATE;

    return {
      networkId: this.config.id,
      sourceAmount: request.sourceAmount,
      sourceCurrency: 'USD',
      destAmount: Math.round(destAmount * 100) / 100,
      destCurrency: 'PHP',
      fxRate: USD_PHP_RATE,
      fee,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      networkMetadata: {
        provider: 'GCash by Globe',
        corridor: 'USD-PHP',
      },
    };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    await this.simulateDelay(200, 400);

    const phone = request.receiver.phone;
    if (!phone || !phone.startsWith('+63')) {
      return {
        networkPaymentId: '',
        status: 'FAILED',
        networkMetadata: { error: 'Invalid Philippine phone number' },
      };
    }

    const networkPaymentId = this.generateNetworkId('GCASH');

    this.payments.set(networkPaymentId, {
      status: 'PENDING',
      data: {
        phone,
        amount: request.destAmount,
        currency: 'PHP',
        externalId: request.externalId,
      },
    });

    // Simulate async callback (1-3 seconds - GCash is typically faster)
    this.simulateAsyncCallback(networkPaymentId);

    return {
      networkPaymentId,
      status: 'PENDING',
      networkMetadata: {
        referenceId: this.generateNetworkId('REF'),
        message: 'Transaction is being processed.',
      },
    };
  }

  async confirmPayment(networkPaymentId: string): Promise<PaymentConfirmationResult> {
    await this.simulateDelay(100, 200);

    const payment = this.payments.get(networkPaymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${networkPaymentId}`);
    }

    return {
      status: payment.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      networkMetadata: payment.data,
    };
  }

  private simulateAsyncCallback(networkPaymentId: string): void {
    const delay = 1000 + Math.random() * 2000; // 1-3 seconds

    setTimeout(() => {
      const payment = this.payments.get(networkPaymentId);
      if (!payment) return;

      // 92% success rate (slightly higher than M-Pesa)
      const success = Math.random() < 0.92;

      payment.status = success ? 'COMPLETED' : 'FAILED';
      payment.data = {
        ...payment.data,
        status: success ? 'SUCCESS' : 'FAILED',
        message: success
          ? 'Payment completed successfully.'
          : 'Transaction failed. Please try again.',
        transactionId: success ? this.generateNetworkId('TXN') : undefined,
        completedAt: new Date().toISOString(),
      };
    }, delay);
  }
}
