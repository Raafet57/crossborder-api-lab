import { MpesaCallback, InboundNetworkEvent } from '../types';

/**
 * Parse M-Pesa callback
 */
export function parseMpesaCallback(body: MpesaCallback): InboundNetworkEvent | null {
  const callback = body.Body?.stkCallback;
  if (!callback) return null;

  const isSuccess = callback.ResultCode === 0;

  const metadata: Record<string, unknown> = {};
  if (callback.CallbackMetadata?.Item) {
    for (const item of callback.CallbackMetadata.Item) {
      metadata[item.Name] = item.Value;
    }
  }

  return {
    source: 'mpesa',
    networkPaymentId: callback.CheckoutRequestID,
    status: isSuccess ? 'COMPLETED' : 'FAILED',
    data: {
      merchantRequestId: callback.MerchantRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
      ...metadata,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse GCash callback (similar pattern)
 */
export function parseGcashCallback(body: {
  transactionId: string;
  referenceId: string;
  status: string;
  amount: number;
  timestamp: string;
}): InboundNetworkEvent {
  const statusMap: Record<string, string> = {
    'SUCCESS': 'COMPLETED',
    'FAILED': 'FAILED',
    'EXPIRED': 'CANCELLED',
  };

  return {
    source: 'gcash',
    networkPaymentId: body.transactionId,
    status: statusMap[body.status] || body.status,
    data: {
      referenceId: body.referenceId,
      amount: body.amount,
    },
    timestamp: body.timestamp || new Date().toISOString(),
  };
}
