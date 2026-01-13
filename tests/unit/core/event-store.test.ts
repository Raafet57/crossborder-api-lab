import { describe, it, expect, beforeEach } from '@jest/globals';
import { EventStore } from '@crossborder/core';

describe('EventStore', () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore();
  });

  it('appends events with incrementing version', async () => {
    const event1 = await store.append('pay_1', 'payment.created', { amount: 100 });
    const event2 = await store.append('pay_1', 'payment.confirmed', {});

    expect(event1.version).toBe(1);
    expect(event2.version).toBe(2);
  });

  it('retrieves events by aggregateId', async () => {
    await store.append('pay_1', 'payment.created', {});
    await store.append('pay_2', 'payment.created', {});
    await store.append('pay_1', 'payment.confirmed', {});

    const events = await store.getEvents('pay_1');
    expect(events).toHaveLength(2);
    expect(events.every(e => e.aggregateId === 'pay_1')).toBe(true);
  });

  it('retrieves events in order', async () => {
    await store.append('pay_1', 'payment.created', {});
    await store.append('pay_1', 'payment.submitted', {});
    await store.append('pay_1', 'payment.confirmed', {});

    const events = await store.getEvents('pay_1');
    expect(events[0].type).toBe('payment.created');
    expect(events[1].type).toBe('payment.submitted');
    expect(events[2].type).toBe('payment.confirmed');
  });

  it('handles getEvents for non-existent aggregate', async () => {
    const events = await store.getEvents('non_existent');
    expect(events).toEqual([]);
  });

  it('builds current state from events', async () => {
    await store.append('pay_1', 'payment.created', { status: 'CREATED', amount: 100 });
    await store.append('pay_1', 'payment.confirmed', { status: 'CONFIRMED' });

    const state = await store.getSnapshot('pay_1');
    expect(state.status).toBe('CONFIRMED');
    expect(state.amount).toBe(100);
  });

  it('supports multiple aggregates independently', async () => {
    await store.append('pay_1', 'payment.created', {});
    await store.append('pay_2', 'payment.created', {});
    await store.append('pay_1', 'payment.completed', {});

    const events1 = await store.getEvents('pay_1');
    const events2 = await store.getEvents('pay_2');

    expect(events1).toHaveLength(2);
    expect(events2).toHaveLength(1);
  });
});
