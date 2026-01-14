import { describe, it, expect, beforeEach } from '@jest/globals';
import { PaymentStateMachine, InvalidTransitionError } from '@crossborder/core';

describe('PaymentStateMachine', () => {
  let machine: PaymentStateMachine;

  beforeEach(() => {
    machine = new PaymentStateMachine('CREATED');
  });

  describe('initialization', () => {
    it('starts in CREATED state by default', () => {
      const defaultMachine = new PaymentStateMachine();
      expect(defaultMachine.getState()).toBe('CREATED');
    });

    it('can start in custom state', () => {
      const customMachine = new PaymentStateMachine('SUBMITTED');
      expect(customMachine.getState()).toBe('SUBMITTED');
    });
  });

  describe('canTransition()', () => {
    it('allows valid transitions from CREATED', () => {
      expect(machine.canTransition('LOCK_QUOTE')).toBe(true);
      expect(machine.canTransition('CANCEL')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(machine.canTransition('COMPLETE')).toBe(false);
      expect(machine.canTransition('SUBMIT')).toBe(false);
    });
  });

  describe('transition()', () => {
    it('transitions to QUOTE_LOCKED', () => {
      const newState = machine.transition('LOCK_QUOTE');
      expect(newState).toBe('QUOTE_LOCKED');
      expect(machine.getState()).toBe('QUOTE_LOCKED');
    });

    it('transitions through full happy path', () => {
      machine.transition('LOCK_QUOTE');
      expect(machine.getState()).toBe('QUOTE_LOCKED');

      machine.transition('START_COMPLIANCE');
      expect(machine.getState()).toBe('COMPLIANCE_CHECK');

      machine.transition('COMPLIANCE_PASSED');
      expect(machine.getState()).toBe('PENDING_NETWORK');

      machine.transition('SUBMIT');
      expect(machine.getState()).toBe('SUBMITTED');

      machine.transition('CONFIRM');
      expect(machine.getState()).toBe('CONFIRMED');

      machine.transition('COMPLETE');
      expect(machine.getState()).toBe('COMPLETED');
    });

    it('throws InvalidTransitionError for invalid transitions', () => {
      expect(() => machine.transition('COMPLETE')).toThrow(InvalidTransitionError);
    });

    it('includes from state and trigger in error', () => {
      try {
        machine.transition('INVALID');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTransitionError);
        expect((error as InvalidTransitionError).from).toBe('CREATED');
        expect((error as InvalidTransitionError).trigger).toBe('INVALID');
      }
    });
  });

  describe('getHistory()', () => {
    it('records transition history', () => {
      machine.transition('LOCK_QUOTE');
      machine.transition('START_COMPLIANCE');

      const history = machine.getHistory();
      expect(history).toHaveLength(2);

      expect(history[0]).toMatchObject({
        from: 'CREATED',
        to: 'QUOTE_LOCKED',
        trigger: 'LOCK_QUOTE',
      });

      expect(history[1]).toMatchObject({
        from: 'QUOTE_LOCKED',
        to: 'COMPLIANCE_CHECK',
        trigger: 'START_COMPLIANCE',
      });
    });

    it('includes timestamps in history', () => {
      machine.transition('LOCK_QUOTE');
      const history = machine.getHistory();

      expect(history[0]).toHaveProperty('timestamp');
      expect(new Date(history[0].timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('cancellation', () => {
    it('can cancel from CREATED', () => {
      machine.transition('CANCEL');
      expect(machine.getState()).toBe('CANCELLED');
    });

    it('can cancel from QUOTE_LOCKED', () => {
      machine.transition('LOCK_QUOTE');
      machine.transition('CANCEL');
      expect(machine.getState()).toBe('CANCELLED');
    });

    it('cannot transition from CANCELLED', () => {
      machine.transition('CANCEL');
      expect(machine.canTransition('LOCK_QUOTE')).toBe(false);
    });
  });

  describe('failure', () => {
    it('can fail from SUBMITTED', () => {
      machine.transition('LOCK_QUOTE');
      machine.transition('START_COMPLIANCE');
      machine.transition('COMPLIANCE_PASSED');
      machine.transition('SUBMIT');
      machine.transition('FAIL');
      expect(machine.getState()).toBe('FAILED');
    });

    it('cannot transition from FAILED', () => {
      machine.transition('LOCK_QUOTE');
      machine.transition('START_COMPLIANCE');
      machine.transition('COMPLIANCE_FAILED');
      expect(machine.getState()).toBe('FAILED');
      expect(machine.canTransition('SUBMIT')).toBe(false);
    });
  });
});
