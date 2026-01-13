import { NetworkConfig } from '@crossborder/core';

/** Quote request from client */
export interface QuoteRequest {
  networkId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destCurrency: string;
  mode: 'SOURCE' | 'DESTINATION'; // SOURCE = fixed source amount, DESTINATION = fixed dest amount
}

/** Quote response from network */
export interface NetworkQuote {
  networkId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  fxRate: number;
  fee: number;
  expiresAt: string;
  networkMetadata?: Record<string, unknown>;
}

/** Payment initiation request */
export interface PaymentInitiationRequest {
  quoteId: string;
  networkId: string;
  externalId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  sender: {
    id?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    country?: string;
  };
  receiver: {
    id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;           // For mobile wallets
    walletAddress?: string;   // For stablecoins
    bankAccount?: string;     // For bank transfers
    bankCode?: string;
    email?: string;
  };
  purpose?: string;
  correlationId: string;
}

/** Result of payment initiation */
export interface PaymentInitiationResult {
  networkPaymentId: string;
  status: 'PENDING' | 'SUBMITTED' | 'REQUIRES_ACTION' | 'FAILED';
  networkMetadata: Record<string, unknown>;
  requiresAction?: {
    type: 'REDIRECT' | 'OTP' | 'CONFIRMATION';
    url?: string;
    message?: string;
  };
}

/** Result of payment confirmation */
export interface PaymentConfirmationResult {
  status: 'CONFIRMED' | 'SETTLED' | 'COMPLETED' | 'FAILED';
  confirmedAt: string;
  networkMetadata: Record<string, unknown>;
  failureReason?: string;
}

/** Payment status from network */
export interface NetworkPaymentStatus {
  networkPaymentId: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'SETTLED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  updatedAt: string;
  networkMetadata: Record<string, unknown>;
  failureReason?: string;
}

/** Webhook event from network */
export interface NetworkWebhookEvent {
  type: string;
  networkPaymentId: string;
  status: string;
  timestamp: string;
  rawData: Record<string, unknown>;
}

/** Network adapter interface - all adapters must implement this */
export interface NetworkAdapter {
  /** Network configuration */
  readonly config: NetworkConfig;

  /** Get a quote for a payment */
  getQuote(request: QuoteRequest): Promise<NetworkQuote>;

  /** Initiate a payment */
  initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;

  /** Confirm a payment (optional - some networks auto-confirm) */
  confirmPayment?(networkPaymentId: string): Promise<PaymentConfirmationResult>;

  /** Get current payment status */
  getPaymentStatus(networkPaymentId: string): Promise<NetworkPaymentStatus>;

  /** Parse incoming webhook (optional - not all networks use webhooks) */
  parseWebhook?(rawBody: Buffer, headers: Record<string, string>): Promise<NetworkWebhookEvent>;
}

/** Base class for mock adapters with common functionality */
export abstract class BaseMockAdapter implements NetworkAdapter {
  abstract readonly config: NetworkConfig;
  protected payments: Map<string, { status: string; data: Record<string, unknown> }> = new Map();

  abstract getQuote(request: QuoteRequest): Promise<NetworkQuote>;
  abstract initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;

  async getPaymentStatus(networkPaymentId: string): Promise<NetworkPaymentStatus> {
    const payment = this.payments.get(networkPaymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${networkPaymentId}`);
    }
    return {
      networkPaymentId,
      status: payment.status as NetworkPaymentStatus['status'],
      updatedAt: new Date().toISOString(),
      networkMetadata: payment.data,
    };
  }

  protected simulateDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  protected generateNetworkId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
