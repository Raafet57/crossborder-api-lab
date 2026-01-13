import Stripe from 'stripe';
import { NetworkConfig } from '@crossborder/core';
import {
  NetworkAdapter,
  QuoteRequest,
  NetworkQuote,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentConfirmationResult,
  NetworkPaymentStatus,
  NetworkWebhookEvent,
} from '../../interface';

export class StripeCardAdapter implements NetworkAdapter {
  readonly config: NetworkConfig = {
    id: 'stripe-card',
    type: 'card',
    displayName: 'Card Payment (Stripe)',
    supportedCurrencies: [
      { source: 'USD', dest: 'USD' },
      { source: 'EUR', dest: 'EUR' },
      { source: 'GBP', dest: 'GBP' },
    ],
    requiredFields: [
      { path: 'sender.firstName', type: 'string', description: 'Cardholder first name' },
      { path: 'sender.lastName', type: 'string', description: 'Cardholder last name' },
      { path: 'sender.email', type: 'string', description: 'Cardholder email' },
    ],
    limits: { min: 0.5, max: 999999 },
  };

  private stripe: Stripe;
  private webhookSecret: string;

  constructor(config: { secretKey: string; webhookSecret?: string }) {
    this.stripe = new Stripe(config.secretKey);
    this.webhookSecret = config.webhookSecret || '';
  }

  async getQuote(request: QuoteRequest): Promise<NetworkQuote> {
    // Card payments: no FX, 2.9% + $0.30 fee simulation
    const fee = request.sourceAmount * 0.029 + 0.30;
    return {
      networkId: this.config.id,
      sourceAmount: request.sourceAmount,
      sourceCurrency: request.sourceCurrency,
      destAmount: request.sourceAmount - fee,
      destCurrency: request.destCurrency,
      fxRate: 1,
      fee,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(request.sourceAmount * 100), // Stripe uses cents
      currency: request.sourceCurrency.toLowerCase(),
      metadata: {
        externalId: request.externalId,
        correlationId: request.correlationId,
      },
      receipt_email: request.sender.email,
      description: request.purpose || 'Cross-border payment',
    });

    return {
      networkPaymentId: paymentIntent.id,
      status: paymentIntent.status === 'requires_payment_method' ? 'REQUIRES_ACTION' : 'PENDING',
      networkMetadata: {
        clientSecret: paymentIntent.client_secret,
        stripeStatus: paymentIntent.status,
      },
      requiresAction: paymentIntent.status === 'requires_action' ? {
        type: 'REDIRECT',
        url: paymentIntent.next_action?.redirect_to_url?.url ?? undefined,
      } : undefined,
    };
  }

  async confirmPayment(networkPaymentId: string): Promise<PaymentConfirmationResult> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(networkPaymentId);

    return {
      status: this.mapStripeStatusForConfirmation(paymentIntent.status),
      confirmedAt: new Date().toISOString(),
      networkMetadata: {
        stripeStatus: paymentIntent.status,
        chargeId: paymentIntent.latest_charge,
      },
      failureReason: paymentIntent.last_payment_error?.message,
    };
  }

  async getPaymentStatus(networkPaymentId: string): Promise<NetworkPaymentStatus> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(networkPaymentId);

    return {
      networkPaymentId,
      status: this.mapStripeStatus(paymentIntent.status),
      updatedAt: new Date(paymentIntent.created * 1000).toISOString(),
      networkMetadata: {
        stripeStatus: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
      failureReason: paymentIntent.last_payment_error?.message,
    };
  }

  async parseWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<NetworkWebhookEvent> {
    const signature = headers['stripe-signature'];
    if (!signature || !this.webhookSecret) {
      throw new Error('Missing Stripe signature or webhook secret');
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    return {
      type: event.type,
      networkPaymentId: paymentIntent.id,
      status: this.mapStripeStatus(paymentIntent.status),
      timestamp: new Date(event.created * 1000).toISOString(),
      rawData: event.data.object as unknown as Record<string, unknown>,
    };
  }

  private mapStripeStatus(stripeStatus: string): NetworkPaymentStatus['status'] {
    const statusMap: Record<string, NetworkPaymentStatus['status']> = {
      'requires_payment_method': 'PENDING',
      'requires_confirmation': 'PENDING',
      'requires_action': 'PENDING',
      'processing': 'SUBMITTED',
      'requires_capture': 'CONFIRMED',
      'succeeded': 'COMPLETED',
      'canceled': 'CANCELLED',
    };
    return statusMap[stripeStatus] || 'FAILED';
  }

  private mapStripeStatusForConfirmation(stripeStatus: string): PaymentConfirmationResult['status'] {
    const statusMap: Record<string, PaymentConfirmationResult['status']> = {
      'requires_capture': 'CONFIRMED',
      'succeeded': 'COMPLETED',
    };
    return statusMap[stripeStatus] || 'FAILED';
  }
}
