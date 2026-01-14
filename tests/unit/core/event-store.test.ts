import { describe, it, expect, beforeEach } from '@jest/globals';
import { EventStore, createPaymentEvent } from '@crossborder/core';

describe('EventStore', () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore();
  });

  it('appends events to the store', () => {
    const event1 = createPaymentEvent('pay_1', 'PaymentCreated', { amount: 100 }, 'corr_1');
    const event2 = createPaymentEvent('pay_1', 'PaymentConfirmed', {}, 'corr_1');

    store.append(event1);
    store.append(event2);

    const events = store.getEvents('pay_1');
    expect(events).toHaveLength(2);
  });

  it('retrieves events by paymentId', () => {
    store.append(createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_2', 'PaymentCreated', {}, 'corr_2'));
    store.append(createPaymentEvent('pay_1', 'PaymentConfirmed', {}, 'corr_1'));

    const events = store.getEvents('pay_1');
    expect(events).toHaveLength(2);
    expect(events.every(e => e.paymentId === 'pay_1')).toBe(true);
  });

  it('retrieves events in chronological order', () => {
    store.append(createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_1', 'PaymentSubmitted', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_1', 'PaymentConfirmed', {}, 'corr_1'));

    const events = store.getEvents('pay_1');
    expect(events[0].type).toBe('PaymentCreated');
    expect(events[1].type).toBe('PaymentSubmitted');
    expect(events[2].type).toBe('PaymentConfirmed');
  });

  it('returns empty array for non-existent payment', () => {
    const events = store.getEvents('non_existent');
    expect(events).toEqual([]);
  });

  it('returns latest event for payment', () => {
    store.append(createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_1', 'PaymentConfirmed', {}, 'corr_1'));

    const latest = store.getLatestEvent('pay_1');
    expect(latest?.type).toBe('PaymentConfirmed');
  });

  it('returns undefined for non-existent payment latest event', () => {
    const latest = store.getLatestEvent('non_existent');
    expect(latest).toBeUndefined();
  });

  it('supports multiple payments independently', () => {
    store.append(createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_2', 'PaymentCreated', {}, 'corr_2'));
    store.append(createPaymentEvent('pay_1', 'PaymentCompleted', {}, 'corr_1'));

    const events1 = store.getEvents('pay_1');
    const events2 = store.getEvents('pay_2');

    expect(events1).toHaveLength(2);
    expect(events2).toHaveLength(1);
  });

  it('getAllEvents returns all events', () => {
    store.append(createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1'));
    store.append(createPaymentEvent('pay_2', 'PaymentCreated', {}, 'corr_2'));

    const allEvents = store.getAllEvents();
    expect(allEvents).toHaveLength(2);
  });

  it('events have unique IDs', () => {
    const event1 = createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1');
    const event2 = createPaymentEvent('pay_1', 'PaymentCreated', {}, 'corr_1');

    expect(event1.id).not.toBe(event2.id);
  });

  it('events include correlation ID', () => {
    const event = createPaymentEvent('pay_1', 'PaymentCreated', { amount: 100 }, 'corr_123');

    expect(event.correlationId).toBe('corr_123');
    expect(event.data).toEqual({ amount: 100 });
  });
});
