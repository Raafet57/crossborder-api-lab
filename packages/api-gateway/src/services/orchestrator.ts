import { v4 as uuidv4 } from 'uuid';
import {
  PaymentStateMachine,
  EventStore,
  createPaymentEvent,
} from '@crossborder/core';
import {
  createNetworkAdapter,
  PaymentInitiationRequest,
  NetworkAdapter,
} from '@crossborder/network-adapters';
import { PaymentStore, StoredPayment } from '../stores/payment-store';
import { quoteService } from './quote';
import { complianceService, ComplianceCheckResult } from './compliance';
import { AppError, ErrorCode } from '../types/errors';
import { CreatePaymentRequest } from '../types/api';
import { config } from '../config';

export class Orchestrator {
  private eventStore: EventStore;
  private paymentStore: PaymentStore;
  private stateMachines = new Map<string, PaymentStateMachine>();

  constructor() {
    this.eventStore = new EventStore();
    this.paymentStore = new PaymentStore(this.eventStore);
  }

  async createPayment(request: CreatePaymentRequest, correlationId: string): Promise<StoredPayment> {
    const quote = quoteService.validateQuote(request.quoteId);

    const paymentId = uuidv4();
    const stateMachine = new PaymentStateMachine('CREATED');
    this.stateMachines.set(paymentId, stateMachine);

    const payment = this.paymentStore.create({
      id: paymentId,
      externalId: request.externalId,
      quoteId: quote.id,
      networkId: quote.networkId,
      status: 'CREATED',
      sourceAmount: quote.sourceAmount,
      sourceCurrency: quote.sourceCurrency,
      destAmount: quote.destAmount,
      destCurrency: quote.destCurrency,
      fee: quote.fee,
      fxRate: quote.fxRate,
      sender: request.sender,
      receiver: request.receiver,
      purpose: request.purpose,
      metadata: request.metadata,
      complianceStatus: 'PENDING',
    });

    this.eventStore.append(createPaymentEvent(paymentId, 'PaymentCreated', {
      quoteId: quote.id,
      networkId: quote.networkId,
      sourceAmount: quote.sourceAmount,
      sourceCurrency: quote.sourceCurrency,
      destAmount: quote.destAmount,
      destCurrency: quote.destCurrency,
    }, correlationId));

    this.transition(paymentId, 'LOCK_QUOTE');
    this.eventStore.append(createPaymentEvent(paymentId, 'QuoteLocked', { quoteId: quote.id }, correlationId));

    const complianceResult = await this.runComplianceCheck(paymentId, request, quote.sourceAmount, quote.sourceCurrency, correlationId);

    if (complianceResult.decision === 'REJECTED') {
      this.transition(paymentId, 'FAIL');
      this.paymentStore.update(paymentId, {
        status: 'FAILED',
        complianceStatus: 'REJECTED',
        complianceDetails: complianceResult as unknown as Record<string, unknown>,
      });

      throw new AppError(
        ErrorCode.COMPLIANCE_REJECTED,
        complianceResult.rejectionReason || 'Payment rejected by compliance',
        { complianceResult }
      );
    }

    this.paymentStore.update(paymentId, {
      status: stateMachine.getState(),
      complianceStatus: complianceResult.decision === 'APPROVED' ? 'APPROVED' : 'PENDING',
      complianceDetails: complianceResult as unknown as Record<string, unknown>,
    });

    if (complianceResult.decision === 'APPROVED') {
      await this.submitToNetwork(paymentId, correlationId);
    }

    return this.paymentStore.get(paymentId)!;
  }

  async confirmPayment(paymentId: string, correlationId: string): Promise<StoredPayment> {
    const payment = this.getPayment(paymentId);
    const stateMachine = this.getStateMachine(paymentId);

    if (!['SUBMITTED', 'PENDING_NETWORK'].includes(payment.status)) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Payment cannot be confirmed in status: ${payment.status}`
      );
    }

    const adapter = this.getAdapter(payment.networkId);

    if (!payment.networkPaymentId) {
      throw new AppError(ErrorCode.CONFLICT, 'Payment has no network payment ID');
    }

    if (!adapter.confirmPayment) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Network does not support explicit confirmation');
    }

    const result = await adapter.confirmPayment(payment.networkPaymentId);

    if (result.status === 'COMPLETED') {
      this.transition(paymentId, 'COMPLETE');
      this.eventStore.append(createPaymentEvent(paymentId, 'PaymentCompleted', {
        networkPaymentId: payment.networkPaymentId,
      }, correlationId));
    } else if (result.status === 'CONFIRMED') {
      this.transition(paymentId, 'CONFIRM');
      this.eventStore.append(createPaymentEvent(paymentId, 'PaymentConfirmed', {
        networkPaymentId: payment.networkPaymentId,
        networkMetadata: result.networkMetadata,
      }, correlationId));
    } else if (result.status === 'FAILED') {
      this.transition(paymentId, 'FAIL');
      this.eventStore.append(createPaymentEvent(paymentId, 'PaymentFailed', {
        reason: result.failureReason,
      }, correlationId));
    }

    return this.paymentStore.update(paymentId, {
      status: stateMachine.getState(),
    })!;
  }

  async cancelPayment(paymentId: string, reason: string | undefined, correlationId: string): Promise<StoredPayment> {
    const payment = this.getPayment(paymentId);
    const stateMachine = this.getStateMachine(paymentId);

    if (!stateMachine.canTransition('CANCEL')) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Payment cannot be cancelled in status: ${payment.status}`
      );
    }

    this.transition(paymentId, 'CANCEL');
    this.eventStore.append(createPaymentEvent(paymentId, 'PaymentCancelled', {
      reason,
    }, correlationId));

    return this.paymentStore.update(paymentId, {
      status: 'CANCELLED',
    })!;
  }

  getPayment(paymentId: string): StoredPayment {
    const payment = this.paymentStore.get(paymentId);

    if (!payment) {
      throw new AppError(ErrorCode.NOT_FOUND, `Payment not found: ${paymentId}`);
    }

    return payment;
  }

  getPaymentEvents(paymentId: string) {
    this.getPayment(paymentId);
    return this.eventStore.getEvents(paymentId);
  }

  getPaymentStore(): PaymentStore {
    return this.paymentStore;
  }

  private async runComplianceCheck(
    paymentId: string,
    request: CreatePaymentRequest,
    amount: number,
    currency: string,
    correlationId: string
  ): Promise<ComplianceCheckResult> {
    this.transition(paymentId, 'START_COMPLIANCE');

    const result = await complianceService.checkPayment(
      request.sender,
      request.receiver,
      amount,
      currency
    );

    this.eventStore.append(createPaymentEvent(paymentId, 'ComplianceCheckCompleted', {
      decision: result.decision,
      riskScore: result.riskScore,
      checks: result.checks,
    }, correlationId));

    if (result.decision === 'APPROVED') {
      this.transition(paymentId, 'PASS_COMPLIANCE');
    }

    return result;
  }

  private async submitToNetwork(paymentId: string, correlationId: string): Promise<void> {
    const payment = this.getPayment(paymentId);
    const adapter = this.getAdapter(payment.networkId);

    this.transition(paymentId, 'SUBMIT');

    const initiationRequest: PaymentInitiationRequest = {
      quoteId: payment.quoteId,
      networkId: payment.networkId,
      externalId: payment.externalId || paymentId,
      sourceAmount: payment.sourceAmount,
      sourceCurrency: payment.sourceCurrency,
      destAmount: payment.destAmount,
      destCurrency: payment.destCurrency,
      sender: {
        id: payment.sender.id,
        firstName: payment.sender.firstName,
        lastName: payment.sender.lastName,
        email: payment.sender.email,
        phone: payment.sender.phone,
        address: payment.sender.address,
        country: payment.sender.country,
      },
      receiver: {
        id: payment.receiver.id,
        firstName: payment.receiver.firstName,
        lastName: payment.receiver.lastName,
        phone: payment.receiver.phone,
        walletAddress: payment.receiver.walletAddress,
        bankAccount: payment.receiver.bankAccount,
        bankCode: payment.receiver.bankCode,
        email: payment.receiver.email,
      },
      purpose: payment.purpose,
      correlationId,
    };

    try {
      const result = await adapter.initiatePayment(initiationRequest);

      this.eventStore.append(createPaymentEvent(paymentId, 'PaymentSubmitted', {
        networkPaymentId: result.networkPaymentId,
        status: result.status,
        networkMetadata: result.networkMetadata,
      }, correlationId));

      this.paymentStore.update(paymentId, {
        status: 'SUBMITTED',
        networkPaymentId: result.networkPaymentId,
        requiresAction: result.requiresAction,
      });

      if (result.status === 'FAILED') {
        this.transition(paymentId, 'FAIL');
        this.paymentStore.update(paymentId, { status: 'FAILED' });
      }
    } catch (error) {
      this.transition(paymentId, 'FAIL');
      this.eventStore.append(createPaymentEvent(paymentId, 'PaymentFailed', {
        reason: error instanceof Error ? error.message : 'Network submission failed',
      }, correlationId));
      this.paymentStore.update(paymentId, { status: 'FAILED' });
      throw error;
    }
  }

  private transition(paymentId: string, trigger: string): void {
    const stateMachine = this.getStateMachine(paymentId);
    stateMachine.transition(trigger);
  }

  private getStateMachine(paymentId: string): PaymentStateMachine {
    const sm = this.stateMachines.get(paymentId);
    if (!sm) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, `State machine not found for payment: ${paymentId}`);
    }
    return sm;
  }

  private getAdapter(networkId: string): NetworkAdapter {
    return createNetworkAdapter(networkId, {
      stripeSecretKey: config.stripe.secretKey,
      stripeWebhookSecret: config.stripe.webhookSecret,
      polygonRpcUrl: config.polygon.rpcUrl,
      polygonPrivateKey: config.polygon.privateKey,
    });
  }
}

export const orchestrator = new Orchestrator();
