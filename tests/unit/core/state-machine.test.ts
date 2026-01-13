import { describe, it, expect, beforeEach } from '@jest/globals';
import { PaymentStateMachine, PaymentStatus, NetworkType } from '@crossborder/core';

describe('PaymentStateMachine', () => {
  let machine: PaymentStateMachine;

  beforeEach(() => {
    machine = new PaymentStateMachine(NetworkType.STABLECOIN);
  });

  describe('initial state', () => {
    it('starts in CREATED state', () => {
      expect(machine.currentState).toBe(PaymentStatus.CREATED);
    });
  });

  describe('common transitions', () => {
    it('transitions CREATED -> QUOTE_LOCKED', () => {
      expect(machine.canTransition(PaymentStatus.QUOTE_LOCKED)).toBe(true);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      expect(machine.currentState).toBe(PaymentStatus.QUOTE_LOCKED);
    });

    it('transitions QUOTE_LOCKED -> COMPLIANCE_CHECK', () => {
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      expect(machine.canTransition(PaymentStatus.COMPLIANCE_CHECK)).toBe(true);
      machine.transition(PaymentStatus.COMPLIANCE_CHECK);
      expect(machine.currentState).toBe(PaymentStatus.COMPLIANCE_CHECK);
    });

    it('can transition to FAILED from any non-terminal state', () => {
      expect(machine.canTransition(PaymentStatus.FAILED)).toBe(true);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      expect(machine.canTransition(PaymentStatus.FAILED)).toBe(true);
    });

    it('can transition to CANCELLED from early states', () => {
      expect(machine.canTransition(PaymentStatus.CANCELLED)).toBe(true);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      expect(machine.canTransition(PaymentStatus.CANCELLED)).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(machine.canTransition(PaymentStatus.COMPLETED)).toBe(false);
      expect(() => machine.transition(PaymentStatus.COMPLETED)).toThrow();
    });
  });

  describe('stablecoin network', () => {
    beforeEach(() => {
      machine = new PaymentStateMachine(NetworkType.STABLECOIN);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      machine.transition(PaymentStatus.COMPLIANCE_CHECK);
    });

    it('transitions COMPLIANCE_CHECK -> SUBMITTED', () => {
      expect(machine.canTransition(PaymentStatus.SUBMITTED)).toBe(true);
      machine.transition(PaymentStatus.SUBMITTED);
      expect(machine.currentState).toBe(PaymentStatus.SUBMITTED);
    });

    it('transitions SUBMITTED -> CONFIRMED', () => {
      machine.transition(PaymentStatus.SUBMITTED);
      expect(machine.canTransition(PaymentStatus.CONFIRMED)).toBe(true);
      machine.transition(PaymentStatus.CONFIRMED);
      expect(machine.currentState).toBe(PaymentStatus.CONFIRMED);
    });

    it('transitions CONFIRMED -> COMPLETED', () => {
      machine.transition(PaymentStatus.SUBMITTED);
      machine.transition(PaymentStatus.CONFIRMED);
      expect(machine.canTransition(PaymentStatus.COMPLETED)).toBe(true);
      machine.transition(PaymentStatus.COMPLETED);
      expect(machine.currentState).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('card network', () => {
    beforeEach(() => {
      machine = new PaymentStateMachine(NetworkType.CARD);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      machine.transition(PaymentStatus.COMPLIANCE_CHECK);
    });

    it('transitions COMPLIANCE_CHECK -> PROCESSING', () => {
      expect(machine.canTransition(PaymentStatus.PROCESSING)).toBe(true);
      machine.transition(PaymentStatus.PROCESSING);
      expect(machine.currentState).toBe(PaymentStatus.PROCESSING);
    });

    it('transitions PROCESSING -> REQUIRES_ACTION for 3DS', () => {
      machine.transition(PaymentStatus.PROCESSING);
      expect(machine.canTransition(PaymentStatus.REQUIRES_ACTION)).toBe(true);
    });

    it('transitions through CONFIRMED -> SETTLED -> COMPLETED', () => {
      machine.transition(PaymentStatus.PROCESSING);
      machine.transition(PaymentStatus.CONFIRMED);
      expect(machine.canTransition(PaymentStatus.SETTLED)).toBe(true);
      machine.transition(PaymentStatus.SETTLED);
      expect(machine.canTransition(PaymentStatus.COMPLETED)).toBe(true);
    });
  });

  describe('mobile wallet network', () => {
    beforeEach(() => {
      machine = new PaymentStateMachine(NetworkType.MOBILE_WALLET);
      machine.transition(PaymentStatus.QUOTE_LOCKED);
      machine.transition(PaymentStatus.COMPLIANCE_CHECK);
    });

    it('transitions to PENDING_USER_ACTION', () => {
      machine.transition(PaymentStatus.SUBMITTED);
      expect(machine.canTransition(PaymentStatus.PENDING_USER_ACTION)).toBe(true);
    });
  });

  describe('getNextStates()', () => {
    it('returns valid next states for current state', () => {
      const nextStates = machine.getNextStates();
      expect(nextStates).toContain(PaymentStatus.QUOTE_LOCKED);
      expect(nextStates).toContain(PaymentStatus.FAILED);
      expect(nextStates).toContain(PaymentStatus.CANCELLED);
    });

    it('returns empty array for terminal states', () => {
      machine.transition(PaymentStatus.FAILED);
      expect(machine.getNextStates()).toEqual([]);
    });
  });
});
