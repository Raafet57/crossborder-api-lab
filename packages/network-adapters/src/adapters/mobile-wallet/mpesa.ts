import { NetworkConfig } from '@crossborder/core';
import {
  BaseMockAdapter,
  QuoteRequest,
  NetworkQuote,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentConfirmationResult,
} from '../../interface';

// FX rate: 1 USD = ~153 KES (simulated)
const USD_KES_RATE = 153.25;
const FEE_PERCENT = 0.015; // 1.5% fee

export class MPesaMockAdapter extends BaseMockAdapter {
  readonly config: NetworkConfig = {
    id: 'mpesa-kenya',
    type: 'mobile_wallet',
    displayName: 'M-Pesa Kenya',
    supportedCurrencies: [
      { source: 'USD', dest: 'KES' },
    ],
    requiredFields: [
      { path: 'receiver.phone', type: 'string', description: 'Recipient phone number (+254...)' },
      { path: 'receiver.firstName', type: 'string', description: 'Recipient first name' },
      { path: 'receiver.lastName', type: 'string', description: 'Recipient last name' },
    ],
    limits: { min: 1, max: 1000 }, // USD limits
  };

  async getQuote(request: QuoteRequest): Promise<NetworkQuote> {
    await this.simulateDelay(50, 150);

    const fee = request.sourceAmount * FEE_PERCENT;
    const netAmount = request.sourceAmount - fee;
    const destAmount = netAmount * USD_KES_RATE;

    return {
      networkId: this.config.id,
      sourceAmount: request.sourceAmount,
      sourceCurrency: 'USD',
      destAmount: Math.round(destAmount * 100) / 100,
      destCurrency: 'KES',
      fxRate: USD_KES_RATE,
      fee,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      networkMetadata: {
        provider: 'Safaricom M-Pesa',
        corridor: 'USD-KES',
      },
    };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    await this.simulateDelay(200, 400);

    const phone = request.receiver.phone;
    if (!phone || !phone.startsWith('+254')) {
      return {
        networkPaymentId: '',
        status: 'FAILED',
        networkMetadata: { error: 'Invalid Kenyan phone number' },
      };
    }

    const networkPaymentId = this.generateNetworkId('MPESA');

    // Store payment as pending
    this.payments.set(networkPaymentId, {
      status: 'PENDING',
      data: {
        phone,
        amount: request.destAmount,
        currency: 'KES',
        externalId: request.externalId,
      },
    });

    // Simulate async M-Pesa callback (1-5 seconds)
    this.simulateAsyncCallback(networkPaymentId);

    return {
      networkPaymentId,
      status: 'PENDING',
      networkMetadata: {
        conversationId: this.generateNetworkId('CONV'),
        originatorConversationId: this.generateNetworkId('ORIG'),
        responseDescription: 'Accept the service request successfully.',
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
    const delay = 1000 + Math.random() * 4000; // 1-5 seconds

    setTimeout(() => {
      const payment = this.payments.get(networkPaymentId);
      if (!payment) return;

      // 90% success rate
      const success = Math.random() < 0.9;

      payment.status = success ? 'COMPLETED' : 'FAILED';
      payment.data = {
        ...payment.data,
        resultCode: success ? 0 : 1,
        resultDesc: success
          ? 'The service request is processed successfully.'
          : 'The balance is insufficient for the transaction.',
        transactionId: success ? this.generateNetworkId('TXN') : undefined,
        completedAt: new Date().toISOString(),
      };
    }, delay);
  }
}
