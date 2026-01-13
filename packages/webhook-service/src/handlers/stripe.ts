import crypto from 'crypto';
import { StripeWebhookEvent, InboundNetworkEvent } from '../types';
import { config } from '../config';

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeSignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signatureParts = parts.filter(p => p.startsWith('v1='));

  if (!timestampPart || signatureParts.length === 0) return false;

  const timestamp = timestampPart.slice(2);
  const signedPayload = `${timestamp}.${payload.toString()}`;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return signatureParts.some(sig => {
    const actualSig = sig.slice(3);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig),
        Buffer.from(actualSig)
      );
    } catch {
      return false;
    }
  });
}

/**
 * Parse Stripe webhook event
 */
export function parseStripeEvent(
  payload: Buffer,
  signature: string
): InboundNetworkEvent | null {
  if (!verifyStripeSignature(payload, signature, config.stripe.webhookSecret)) {
    console.log(JSON.stringify({ type: 'stripe_signature_invalid' }));
    return null;
  }

  const event: StripeWebhookEvent = JSON.parse(payload.toString());

  const statusMap: Record<string, string> = {
    'payment_intent.succeeded': 'CONFIRMED',
    'payment_intent.payment_failed': 'FAILED',
    'payment_intent.requires_action': 'REQUIRES_ACTION',
    'payment_intent.processing': 'PROCESSING',
    'charge.refunded': 'REFUNDED',
  };

  const status = statusMap[event.type];
  if (!status) return null;

  const networkPaymentId = event.data.object.id;
  const ourPaymentId = event.data.object.metadata?.paymentId;

  return {
    source: 'stripe',
    networkPaymentId,
    status,
    data: {
      stripeEventId: event.id,
      stripeEventType: event.type,
      paymentId: ourPaymentId,
      ...event.data.object,
    },
    timestamp: new Date().toISOString(),
  };
}
