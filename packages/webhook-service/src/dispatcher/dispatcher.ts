import { v4 as uuidv4 } from 'uuid';
import { WebhookRegistry } from './registry';
import { signWebhook } from './signer';
import { WebhookPayload, DeliveryAttempt, mapEventType } from '../types';
import { PaymentEvent } from '@crossborder/core';
import { config } from '../config';

export class WebhookDispatcher {
  private registry: WebhookRegistry;

  constructor(registry: WebhookRegistry) {
    this.registry = registry;
  }

  /**
   * Dispatch a payment event to all subscribed webhooks
   */
  async dispatch(event: PaymentEvent): Promise<void> {
    const eventType = mapEventType(event.type);
    const subscriptions = this.registry.getActiveForEvent(eventType);

    const payload: WebhookPayload = {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date().toISOString(),
      data: {
        paymentId: event.paymentId,
        status: event.type,
        ...event.data,
      },
    };

    for (const subscription of subscriptions) {
      this.deliverWithRetry(subscription.id, payload, 1);
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWithRetry(subscriptionId: string, payload: WebhookPayload, attempt: number): Promise<void> {
    const subscription = this.registry.get(subscriptionId);
    if (!subscription) return;

    const { maxRetries, initialDelayMs, timeoutMs, maxDelayMs } = config.dispatcher;
    const startTime = Date.now();

    const deliveryAttempt: DeliveryAttempt = {
      id: uuidv4(),
      subscriptionId,
      payloadId: payload.id,
      attemptNumber: attempt,
      status: 'pending',
      attemptedAt: new Date().toISOString(),
      durationMs: 0,
    };

    try {
      const signed = signWebhook(payload, subscription.secret);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': payload.id,
          'X-Webhook-Signature': signed.signature,
        },
        body: signed.payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      deliveryAttempt.durationMs = Date.now() - startTime;
      deliveryAttempt.httpStatus = response.status;

      if (response.ok) {
        deliveryAttempt.status = 'success';
        this.registry.addDeliveryAttempt(deliveryAttempt);
        console.log(JSON.stringify({
          type: 'webhook_delivered',
          subscriptionId,
          payloadId: payload.id,
          attempt,
          httpStatus: response.status,
        }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      deliveryAttempt.durationMs = Date.now() - startTime;
      deliveryAttempt.status = 'failed';
      deliveryAttempt.error = error instanceof Error ? error.message : 'Unknown error';
      this.registry.addDeliveryAttempt(deliveryAttempt);

      console.log(JSON.stringify({
        type: 'webhook_failed',
        subscriptionId,
        payloadId: payload.id,
        attempt,
        error: deliveryAttempt.error,
      }));

      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        const jitter = delay * 0.1 * Math.random();

        setTimeout(() => {
          this.deliverWithRetry(subscriptionId, payload, attempt + 1);
        }, delay + jitter);
      }
    }
  }

  /**
   * Send a test webhook to verify subscription
   */
  async sendTest(subscriptionId: string): Promise<DeliveryAttempt | undefined> {
    const subscription = this.registry.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const testPayload: WebhookPayload = {
      id: uuidv4(),
      type: 'payment.created',
      timestamp: new Date().toISOString(),
      data: {
        paymentId: 'test_payment_123',
        status: 'PaymentCreated',
        test: true,
      },
    };

    await this.deliverWithRetry(subscriptionId, testPayload, 1);

    await new Promise(resolve => setTimeout(resolve, 100));

    const deliveries = this.registry.getDeliveries(subscriptionId, 1);
    return deliveries[0];
  }
}
