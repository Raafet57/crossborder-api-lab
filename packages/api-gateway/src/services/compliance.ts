import { SenderInfo, ReceiverInfo } from '../types/api';

export type ComplianceDecision = 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';

export interface ComplianceCheckResult {
  decision: ComplianceDecision;
  riskScore: number;
  checks: {
    sanctions: { passed: boolean; details?: string };
    pep: { passed: boolean; details?: string };
    velocityCheck: { passed: boolean; details?: string };
    amountThreshold: { passed: boolean; details?: string };
  };
  reviewRequired: boolean;
  rejectionReason?: string;
}

const SIMULATED_SANCTIONS_LIST = [
  'kim jong',
  'vladimir putin',
  'ali khamenei',
  'test sanctions',
];

const SIMULATED_PEP_LIST = [
  'joe biden',
  'donald trump',
  'test pep',
];

export class ComplianceService {
  private transactionHistory = new Map<string, { count: number; totalAmount: number; lastTxTime: number }>();

  async checkPayment(
    sender: SenderInfo,
    receiver: ReceiverInfo,
    amount: number,
    currency: string
  ): Promise<ComplianceCheckResult> {
    await this.delay(100, 300);

    const checks = {
      sanctions: this.checkSanctions(sender, receiver),
      pep: this.checkPEP(sender),
      velocityCheck: this.checkVelocity(sender.id || sender.email || 'unknown', amount),
      amountThreshold: this.checkAmountThreshold(amount, currency),
    };

    let riskScore = 0;
    if (!checks.sanctions.passed) riskScore += 100;
    if (!checks.pep.passed) riskScore += 30;
    if (!checks.velocityCheck.passed) riskScore += 25;
    if (!checks.amountThreshold.passed) riskScore += 20;

    let decision: ComplianceDecision;
    let rejectionReason: string | undefined;

    if (!checks.sanctions.passed) {
      decision = 'REJECTED';
      rejectionReason = 'Sanctions list match detected';
    } else if (riskScore >= 50) {
      decision = 'PENDING_REVIEW';
    } else {
      decision = 'APPROVED';
    }

    this.recordTransaction(sender.id || sender.email || 'unknown', amount);

    return {
      decision,
      riskScore: Math.min(100, riskScore),
      checks,
      reviewRequired: decision === 'PENDING_REVIEW',
      rejectionReason,
    };
  }

  private checkSanctions(sender: SenderInfo, receiver: ReceiverInfo): { passed: boolean; details?: string } {
    const names = [
      `${sender.firstName} ${sender.lastName}`.toLowerCase(),
      `${receiver.firstName || ''} ${receiver.lastName || ''}`.toLowerCase(),
    ];

    for (const name of names) {
      for (const sanctioned of SIMULATED_SANCTIONS_LIST) {
        if (name.includes(sanctioned)) {
          return { passed: false, details: `Name matches sanctions list: ${sanctioned}` };
        }
      }
    }

    return { passed: true };
  }

  private checkPEP(sender: SenderInfo): { passed: boolean; details?: string } {
    const name = `${sender.firstName} ${sender.lastName}`.toLowerCase();

    for (const pep of SIMULATED_PEP_LIST) {
      if (name.includes(pep)) {
        return { passed: false, details: `Name matches PEP list: ${pep}` };
      }
    }

    return { passed: true };
  }

  private checkVelocity(senderId: string, amount: number): { passed: boolean; details?: string } {
    const history = this.transactionHistory.get(senderId);

    if (!history) {
      return { passed: true };
    }

    const oneHourAgo = Date.now() - 3600000;

    if (history.lastTxTime > oneHourAgo && history.count >= 10) {
      return { passed: false, details: 'Too many transactions in the last hour' };
    }

    if (history.totalAmount + amount > 50000) {
      return { passed: false, details: 'Cumulative transaction amount exceeds $50,000' };
    }

    return { passed: true };
  }

  private checkAmountThreshold(amount: number, currency: string): { passed: boolean; details?: string } {
    const thresholds: Record<string, number> = {
      USD: 10000,
      EUR: 9000,
      GBP: 8000,
    };

    const threshold = thresholds[currency] || 10000;

    if (amount >= threshold) {
      return { passed: false, details: `Amount exceeds ${currency} ${threshold} threshold` };
    }

    return { passed: true };
  }

  private recordTransaction(senderId: string, amount: number): void {
    const existing = this.transactionHistory.get(senderId);

    if (existing) {
      existing.count++;
      existing.totalAmount += amount;
      existing.lastTxTime = Date.now();
    } else {
      this.transactionHistory.set(senderId, {
        count: 1,
        totalAmount: amount,
        lastTxTime: Date.now(),
      });
    }
  }

  private delay(minMs: number, maxMs: number): Promise<void> {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const complianceService = new ComplianceService();
