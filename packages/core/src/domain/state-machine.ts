/**
 * Payment state machine for managing payment lifecycle
 */

import { PaymentStatus } from '../types';

/** State transition record */
export interface StateTransition {
  from: PaymentStatus;
  to: PaymentStatus;
  trigger: string;
  timestamp: string;
}

/** Allowed state transitions map */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, { trigger: string; to: PaymentStatus }[]> = {
  CREATED: [
    { trigger: 'LOCK_QUOTE', to: 'QUOTE_LOCKED' },
    { trigger: 'CANCEL', to: 'CANCELLED' },
  ],
  QUOTE_LOCKED: [
    { trigger: 'START_COMPLIANCE', to: 'COMPLIANCE_CHECK' },
    { trigger: 'CANCEL', to: 'CANCELLED' },
  ],
  COMPLIANCE_CHECK: [
    { trigger: 'COMPLIANCE_PASSED', to: 'PENDING_NETWORK' },
    { trigger: 'COMPLIANCE_FAILED', to: 'FAILED' },
    { trigger: 'CANCEL', to: 'CANCELLED' },
  ],
  PENDING_NETWORK: [
    { trigger: 'SUBMIT', to: 'SUBMITTED' },
    { trigger: 'FAIL', to: 'FAILED' },
    { trigger: 'CANCEL', to: 'CANCELLED' },
  ],
  SUBMITTED: [
    { trigger: 'CONFIRM', to: 'CONFIRMED' },
    { trigger: 'FAIL', to: 'FAILED' },
  ],
  CONFIRMED: [
    { trigger: 'SETTLE', to: 'SETTLED' },
    { trigger: 'COMPLETE', to: 'COMPLETED' },
    { trigger: 'FAIL', to: 'FAILED' },
  ],
  SETTLED: [
    { trigger: 'COMPLETE', to: 'COMPLETED' },
    { trigger: 'FAIL', to: 'FAILED' },
  ],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

/** Error thrown when an invalid state transition is attempted */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: PaymentStatus,
    public readonly trigger: string
  ) {
    super(`Invalid transition: cannot apply '${trigger}' from state '${from}'`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Payment state machine
 * Manages payment status transitions with history tracking
 */
export class PaymentStateMachine {
  private state: PaymentStatus;
  private history: StateTransition[] = [];

  /**
   * Create a new state machine
   * @param initialState - Starting state (default: CREATED)
   */
  constructor(initialState: PaymentStatus = 'CREATED') {
    this.state = initialState;
  }

  /**
   * Get current state
   */
  getState(): PaymentStatus {
    return this.state;
  }

  /**
   * Get transition history
   */
  getHistory(): StateTransition[] {
    return [...this.history];
  }

  /**
   * Check if a transition is allowed
   * @param trigger - Transition trigger
   * @returns True if transition is allowed
   */
  canTransition(trigger: string): boolean {
    const transitions = ALLOWED_TRANSITIONS[this.state];
    return transitions.some((t) => t.trigger === trigger);
  }

  /**
   * Execute a state transition
   * @param trigger - Transition trigger
   * @returns New state after transition
   * @throws InvalidTransitionError if transition not allowed
   */
  transition(trigger: string): PaymentStatus {
    const transitions = ALLOWED_TRANSITIONS[this.state];
    const allowed = transitions.find((t) => t.trigger === trigger);

    if (!allowed) {
      throw new InvalidTransitionError(this.state, trigger);
    }

    const from = this.state;
    this.state = allowed.to;

    this.history.push({
      from,
      to: this.state,
      trigger,
      timestamp: new Date().toISOString(),
    });

    return this.state;
  }
}
