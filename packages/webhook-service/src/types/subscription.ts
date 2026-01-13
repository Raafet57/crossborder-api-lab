export type WebhookEventType =
  | 'payment.created'
  | 'payment.quote_locked'
  | 'payment.compliance_check.started'
  | 'payment.compliance_check.completed'
  | 'payment.compliance_check.failed'
  | 'payment.submitted'
  | 'payment.confirmed'
  | 'payment.settled'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'payment.requires_action'
  | '*';

export interface WebhookSubscription {
  id: string;
  clientId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttempt {
  id: string;
  subscriptionId: string;
  payloadId: string;
  attemptNumber: number;
  status: 'pending' | 'success' | 'failed';
  httpStatus?: number;
  responseBody?: string;
  error?: string;
  attemptedAt: string;
  durationMs: number;
}

export interface CreateSubscriptionRequest {
  url: string;
  secret: string;
  events: WebhookEventType[];
}

export interface UpdateSubscriptionRequest {
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  active?: boolean;
}
