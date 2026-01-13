/**
 * In-memory event store for event sourcing
 */

import { PaymentEvent } from './events';

/**
 * In-memory event store
 * Stores payment events and provides query methods
 */
export class EventStore {
  private events: PaymentEvent[] = [];

  /**
   * Append an event to the store
   * @param event - Event to append
   */
  append(event: PaymentEvent): void {
    this.events.push(event);
  }

  /**
   * Get all events for a payment
   * @param paymentId - Payment ID
   * @returns Array of events sorted by timestamp
   */
  getEvents(paymentId: string): PaymentEvent[] {
    return this.events
      .filter((e) => e.paymentId === paymentId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get the latest event for a payment
   * @param paymentId - Payment ID
   * @returns Latest event or undefined if none exist
   */
  getLatestEvent(paymentId: string): PaymentEvent | undefined {
    const events = this.getEvents(paymentId);
    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  /**
   * Get all events in the store
   * @returns All events sorted by timestamp
   */
  getAllEvents(): PaymentEvent[] {
    return [...this.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}
