// Stripe webhook event (simplified)
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      metadata?: Record<string, string>;
      [key: string]: unknown;
    };
  };
}

// M-Pesa callback
export interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}

// GCash callback
export interface GcashCallback {
  transactionId: string;
  referenceId: string;
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
  amount: number;
  timestamp: string;
  signature: string;
}

// Parsed inbound event (normalized)
export interface InboundNetworkEvent {
  source: 'stripe' | 'polygon' | 'mpesa' | 'gcash';
  networkPaymentId: string;
  status: string;
  data: Record<string, unknown>;
  timestamp: string;
}
