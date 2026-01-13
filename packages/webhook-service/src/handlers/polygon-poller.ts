import { EventStore, createPaymentEvent } from '@crossborder/core';
import { config } from '../config';

interface PendingTransaction {
  paymentId: string;
  txHash: string;
  submittedAt: number;
  confirmations: number;
}

/**
 * Polls for Polygon transaction confirmations
 * In a real implementation, this would use ethers.js to check block confirmations
 */
export class PolygonPoller {
  private eventStore: EventStore;
  private pendingTxs: Map<string, PendingTransaction> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  start(): void {
    if (this.pollInterval) return;

    console.log(JSON.stringify({
      type: 'polygon_poller_started',
      intervalMs: config.polygon.pollIntervalMs,
    }));

    this.pollInterval = setInterval(() => {
      this.poll();
    }, config.polygon.pollIntervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Track a new transaction for confirmation polling
   */
  trackTransaction(paymentId: string, txHash: string): void {
    this.pendingTxs.set(txHash, {
      paymentId,
      txHash,
      submittedAt: Date.now(),
      confirmations: 0,
    });

    console.log(JSON.stringify({
      type: 'polygon_tx_tracked',
      paymentId,
      txHash,
    }));
  }

  /**
   * Poll for confirmations (simulated for demo)
   */
  private poll(): void {
    for (const [txHash, tx] of this.pendingTxs.entries()) {
      // Simulate confirmation progress
      tx.confirmations += Math.floor(Math.random() * 3) + 1;

      console.log(JSON.stringify({
        type: 'polygon_tx_poll',
        txHash,
        paymentId: tx.paymentId,
        confirmations: tx.confirmations,
        required: config.polygon.confirmationsRequired,
      }));

      if (tx.confirmations >= config.polygon.confirmationsRequired) {
        const event = createPaymentEvent(
          tx.paymentId,
          'PaymentConfirmed',
          {
            txHash,
            confirmations: tx.confirmations,
            network: 'polygon',
          },
          `poller-${Date.now()}`
        );

        this.eventStore.append(event);
        this.pendingTxs.delete(txHash);

        console.log(JSON.stringify({
          type: 'polygon_tx_confirmed',
          txHash,
          paymentId: tx.paymentId,
          confirmations: tx.confirmations,
        }));
      }
    }
  }

  /**
   * Get pending transaction count
   */
  getPendingCount(): number {
    return this.pendingTxs.size;
  }
}
