import { NetworkConfig } from '@crossborder/core';
import {
  BaseMockAdapter,
  QuoteRequest,
  NetworkQuote,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentConfirmationResult,
} from '../../interface';

// Simulated: 1 TBOND = 1 USD (treasury bond token)
const MANAGEMENT_FEE_PERCENT = 0.001; // 0.1% management fee

export class RWAMockAdapter extends BaseMockAdapter {
  readonly config: NetworkConfig = {
    id: 'rwa-treasury',
    type: 'tokenized_asset',
    displayName: 'Tokenized US Treasury Bonds',
    supportedCurrencies: [
      { source: 'USD', dest: 'TBOND' },
    ],
    requiredFields: [
      { path: 'receiver.walletAddress', type: 'string', description: 'Custody wallet address' },
      { path: 'sender.kycVerified', type: 'boolean', description: 'KYC verification status' },
    ],
    limits: { min: 1000, max: 1000000 }, // Higher minimums for RWA
  };

  // Settlement windows (T+1)
  private settlementQueue: Map<string, { settlesAt: Date; paymentId: string }> = new Map();

  async getQuote(request: QuoteRequest): Promise<NetworkQuote> {
    await this.simulateDelay(100, 300);

    const fee = request.sourceAmount * MANAGEMENT_FEE_PERCENT;

    return {
      networkId: this.config.id,
      sourceAmount: request.sourceAmount,
      sourceCurrency: 'USD',
      destAmount: request.sourceAmount - fee, // 1:1 minus fee
      destCurrency: 'TBOND',
      fxRate: 1,
      fee,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      networkMetadata: {
        assetType: 'US_TREASURY_BOND',
        settlementType: 'T+1',
        custodian: 'Mock Custody Services',
        yield: '4.25%', // Simulated yield
      },
    };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    await this.simulateDelay(300, 600);

    const walletAddress = request.receiver.walletAddress;
    if (!walletAddress) {
      return {
        networkPaymentId: '',
        status: 'FAILED',
        networkMetadata: { error: 'Custody wallet address required' },
      };
    }

    const networkPaymentId = this.generateNetworkId('RWA');

    // Calculate T+1 settlement time (next business day 4pm EST simulation)
    const settlesAt = this.calculateSettlementTime();

    this.payments.set(networkPaymentId, {
      status: 'PENDING',
      data: {
        walletAddress,
        amount: request.destAmount,
        currency: 'TBOND',
        externalId: request.externalId,
        settlesAt: settlesAt.toISOString(),
        orderType: 'BUY',
      },
    });

    this.settlementQueue.set(networkPaymentId, { settlesAt, paymentId: networkPaymentId });

    // Simulate settlement at scheduled time (or 5-10 seconds for demo)
    this.simulateSettlement(networkPaymentId);

    return {
      networkPaymentId,
      status: 'PENDING',
      networkMetadata: {
        orderId: this.generateNetworkId('ORD'),
        settlementDate: settlesAt.toISOString(),
        status: 'QUEUED',
        message: 'Order queued for T+1 settlement.',
      },
    };
  }

  async confirmPayment(networkPaymentId: string): Promise<PaymentConfirmationResult> {
    await this.simulateDelay(100, 200);

    const payment = this.payments.get(networkPaymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${networkPaymentId}`);
    }

    const settlement = this.settlementQueue.get(networkPaymentId);
    const isSettled = settlement && new Date() >= settlement.settlesAt;

    return {
      status: payment.status === 'COMPLETED' ? 'COMPLETED' :
              isSettled ? 'SETTLED' : 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      networkMetadata: {
        ...payment.data,
        settlementStatus: isSettled ? 'SETTLED' : 'PENDING_SETTLEMENT',
      },
    };
  }

  private calculateSettlementTime(): Date {
    // For demo: settle in 5-10 seconds instead of T+1
    const now = new Date();
    return new Date(now.getTime() + 5000 + Math.random() * 5000);
  }

  private simulateSettlement(networkPaymentId: string): void {
    const settlement = this.settlementQueue.get(networkPaymentId);
    if (!settlement) return;

    const delay = settlement.settlesAt.getTime() - Date.now();

    setTimeout(() => {
      const payment = this.payments.get(networkPaymentId);
      if (!payment) return;

      // 95% success rate for RWA (higher reliability)
      const success = Math.random() < 0.95;

      payment.status = success ? 'COMPLETED' : 'FAILED';
      payment.data = {
        ...payment.data,
        settlementStatus: success ? 'SETTLED' : 'FAILED',
        settledAt: new Date().toISOString(),
        transactionId: success ? this.generateNetworkId('SETTLE') : undefined,
        failureReason: success ? undefined : 'Settlement failed - insufficient liquidity',
      };

      this.settlementQueue.delete(networkPaymentId);
    }, Math.max(delay, 0));
  }
}
