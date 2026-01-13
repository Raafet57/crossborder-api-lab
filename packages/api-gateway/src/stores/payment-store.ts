import { PaymentStatus, PaymentEvent, EventStore } from '@crossborder/core';
import { PaymentResponse, SenderInfo, ReceiverInfo } from '../types/api';

export interface StoredPayment {
  id: string;
  externalId?: string;
  quoteId: string;
  networkId: string;
  status: PaymentStatus;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  fee: number;
  fxRate: number;
  sender: SenderInfo;
  receiver: ReceiverInfo;
  purpose?: string;
  metadata?: Record<string, string>;
  networkPaymentId?: string;
  requiresAction?: {
    type: 'REDIRECT' | 'OTP' | 'CONFIRMATION';
    url?: string;
    message?: string;
  };
  complianceStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  complianceDetails?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentStore {
  private payments = new Map<string, StoredPayment>();
  private eventStore: EventStore;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  create(payment: Omit<StoredPayment, 'createdAt' | 'updatedAt'>): StoredPayment {
    const now = new Date();
    const stored: StoredPayment = {
      ...payment,
      createdAt: now,
      updatedAt: now,
    };

    this.payments.set(payment.id, stored);
    return stored;
  }

  get(id: string): StoredPayment | undefined {
    return this.payments.get(id);
  }

  getByExternalId(externalId: string): StoredPayment | undefined {
    for (const payment of this.payments.values()) {
      if (payment.externalId === externalId) {
        return payment;
      }
    }
    return undefined;
  }

  update(id: string, updates: Partial<StoredPayment>): StoredPayment | undefined {
    const existing = this.payments.get(id);
    if (!existing) return undefined;

    const updated: StoredPayment = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.payments.set(id, updated);
    return updated;
  }

  list(options: { limit?: number; offset?: number; status?: PaymentStatus } = {}): {
    payments: StoredPayment[];
    total: number;
  } {
    let payments = Array.from(this.payments.values());

    if (options.status) {
      payments = payments.filter(p => p.status === options.status);
    }

    payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = payments.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      payments: payments.slice(offset, offset + limit),
      total,
    };
  }

  getEvents(paymentId: string): PaymentEvent[] {
    return this.eventStore.getEvents(paymentId);
  }

  toResponse(payment: StoredPayment): PaymentResponse {
    return {
      id: payment.id,
      externalId: payment.externalId,
      quoteId: payment.quoteId,
      networkId: payment.networkId,
      status: payment.status,
      sourceAmount: payment.sourceAmount,
      sourceCurrency: payment.sourceCurrency,
      destAmount: payment.destAmount,
      destCurrency: payment.destCurrency,
      fee: payment.fee,
      fxRate: payment.fxRate,
      sender: payment.sender,
      receiver: payment.receiver,
      purpose: payment.purpose,
      metadata: payment.metadata,
      networkPaymentId: payment.networkPaymentId,
      requiresAction: payment.requiresAction,
      complianceStatus: payment.complianceStatus,
      complianceDetails: payment.complianceDetails,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}
