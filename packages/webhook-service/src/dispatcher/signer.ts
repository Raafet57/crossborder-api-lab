import crypto from 'crypto';
import { WebhookPayload } from '../types';

export interface SignedWebhook {
  payload: string;
  signature: string;
  timestamp: number;
}

/**
 * Sign a webhook payload with HMAC-SHA256
 * Signature format: t=<timestamp>,v1=<signature>
 */
export function signWebhook(payload: WebhookPayload, secret: string): SignedWebhook {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return {
    payload: payloadString,
    signature: `t=${timestamp},v1=${signature}`,
    timestamp,
  };
}

/**
 * Verify a webhook signature (for clients to use)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = parseInt(timestampPart.slice(2), 10);
  const expectedSig = signaturePart.slice(3);

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(computedSig)
    );
  } catch {
    return false;
  }
}
