/**
 * Domain events for event sourcing
 */

import { generateId } from '../utils/crypto';

/** Payment event types */
export type PaymentEventType =
  | 'PaymentCreated'
  | 'QuoteLocked'
  | 'ComplianceCheckStarted'
  | 'ComplianceCheckCompleted'
  | 'PaymentSubmitted'
  | 'PaymentConfirmed'
  | 'PaymentSettled'
  | 'PaymentCompleted'
  | 'PaymentFailed'
  | 'PaymentCancelled';

/** Payment event structure */
export interface PaymentEvent {
  id: string;
  paymentId: string;
  type: PaymentEventType;
  timestamp: string;
  data: Record<string, unknown>;
  correlationId: string;
}

/**
 * Create a new payment event
 * @param paymentId - ID of the payment
 * @param type - Event type
 * @param data - Event data payload
 * @param correlationId - Correlation ID for tracing
 * @returns New PaymentEvent
 */
export function createPaymentEvent(
  paymentId: string,
  type: PaymentEventType,
  data: Record<string, unknown>,
  correlationId: string
): PaymentEvent {
  return {
    id: generateId(),
    paymentId,
    type,
    timestamp: new Date().toISOString(),
    data,
    correlationId,
  };
}
