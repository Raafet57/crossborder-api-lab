import { WebhookEventType } from './subscription';

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: {
    paymentId: string;
    status: string;
    networkId?: string;
    [key: string]: unknown;
  };
}

// Map internal event types to webhook event types
export function mapEventType(internalType: string): WebhookEventType {
  const mapping: Record<string, WebhookEventType> = {
    'PaymentCreated': 'payment.created',
    'QuoteLocked': 'payment.quote_locked',
    'ComplianceCheckStarted': 'payment.compliance_check.started',
    'ComplianceCheckCompleted': 'payment.compliance_check.completed',
    'PaymentSubmitted': 'payment.submitted',
    'PaymentConfirmed': 'payment.confirmed',
    'PaymentSettled': 'payment.settled',
    'PaymentCompleted': 'payment.completed',
    'PaymentFailed': 'payment.failed',
    'PaymentCancelled': 'payment.cancelled',
  };
  return mapping[internalType] || 'payment.created';
}
