import { v4 as uuidv4 } from 'uuid';
import {
  WebhookSubscription,
  DeliveryAttempt,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  WebhookEventType,
} from '../types';

export class WebhookRegistry {
  private subscriptions = new Map<string, WebhookSubscription>();
  private deliveries = new Map<string, DeliveryAttempt[]>();

  constructor() {
    // Seed a demo subscription
    this.create('demo-client', {
      url: 'https://webhook.site/test',
      secret: 'whsec_demo_secret_123',
      events: ['*'],
    });
  }

  create(clientId: string, request: CreateSubscriptionRequest): WebhookSubscription {
    const now = new Date().toISOString();
    const subscription: WebhookSubscription = {
      id: uuidv4(),
      clientId,
      url: request.url,
      secret: request.secret,
      events: request.events,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  get(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id);
  }

  getByClientId(clientId: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.clientId === clientId);
  }

  getActiveForEvent(eventType: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.active && (s.events.includes('*') || s.events.includes(eventType as WebhookEventType)));
  }

  update(id: string, updates: UpdateSubscriptionRequest): WebhookSubscription | undefined {
    const existing = this.subscriptions.get(id);
    if (!existing) return undefined;

    const updated: WebhookSubscription = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  addDeliveryAttempt(attempt: DeliveryAttempt): void {
    const existing = this.deliveries.get(attempt.subscriptionId) || [];
    existing.push(attempt);
    if (existing.length > 100) existing.shift();
    this.deliveries.set(attempt.subscriptionId, existing);
  }

  getDeliveries(subscriptionId: string, limit = 20): DeliveryAttempt[] {
    const deliveries = this.deliveries.get(subscriptionId) || [];
    return deliveries.slice(-limit).reverse();
  }
}
