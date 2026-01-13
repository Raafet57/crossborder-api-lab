import chalk from 'chalk';
import type { Payment, Quote, PaymentEvent } from '@crossborder/sdk';

export function printHeader(): void {
  console.log(chalk.cyan('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('║  Cross-Border Payments Demo          ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════╝\n'));
}

export function printQuote(quote: Quote): void {
  console.log(chalk.green('\n✓ Quote created:'), chalk.bold(quote.id));
  console.log(`  Rate: ${quote.fxRate} | Fee: $${quote.fee.toFixed(2)} | You receive: ${quote.destAmount} ${quote.destCurrency}`);
  console.log(`  Expires: ${new Date(quote.expiresAt).toLocaleTimeString()}\n`);
}

export function printPayment(payment: Payment): void {
  console.log(chalk.green('\n✓ Payment:'), chalk.bold(payment.id));
  console.log(`  Status: ${formatStatus(payment.status)}`);
  if (payment.networkPaymentId) {
    console.log(`  Network TX: ${payment.networkPaymentId}`);
  }
  console.log();
}

export function printEvents(events: PaymentEvent[]): void {
  console.log(chalk.cyan('\nEvent History:'));
  events.forEach((event, index) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    console.log(`  ${index + 1}. ${event.type.padEnd(25)} - ${time}`);
  });
  console.log();
}

export function printError(message: string): void {
  console.log(chalk.red('\n✗ Error:'), message, '\n');
}

export function printSuccess(message: string): void {
  console.log(chalk.green('\n✓'), message, '\n');
}

export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function formatStatus(status: string): string {
  const colors: Record<string, (s: string) => string> = {
    CREATED: chalk.blue,
    QUOTE_LOCKED: chalk.blue,
    COMPLIANCE_CHECK: chalk.yellow,
    SUBMITTED: chalk.yellow,
    PENDING_USER_ACTION: chalk.yellow,
    CONFIRMED: chalk.green,
    SETTLED: chalk.green,
    COMPLETED: chalk.green.bold,
    FAILED: chalk.red.bold,
    CANCELLED: chalk.gray,
  };
  const colorFn = colors[status] || chalk.white;
  return colorFn(status);
}

export function printScenarioResult(name: string, passed: boolean, duration: number): void {
  const status = passed ? chalk.green('PASSED') : chalk.red('FAILED');
  console.log(`\nResult: ${status} (${(duration / 1000).toFixed(1)}s)\n`);
}

export function printSummary(passed: number, total: number): void {
  console.log(chalk.cyan('═══════════════════════════════════════'));
  const color = passed === total ? chalk.green : chalk.red;
  console.log(color(`Summary: ${passed}/${total} scenarios passed`));
  console.log(chalk.cyan('═══════════════════════════════════════\n'));
}
