import { select, input, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { CrossBorderClient, type Quote, type Payment } from '@crossborder/sdk';
import * as display from './display.js';

const NETWORK_CHOICES = [
  { name: 'Stablecoin (Polygon USDC)', value: 'polygon-usdc' },
  { name: 'Card (Stripe)', value: 'stripe' },
  { name: 'Mobile Wallet (M-Pesa)', value: 'mpesa' },
  { name: 'Tokenized Assets (RWA)', value: 'rwa-tbonds' },
];

export async function runInteractive(client: CrossBorderClient): Promise<void> {
  display.printHeader();
  console.log('Interactive Mode - Walk through a payment flow\n');

  try {
    // Step 1: Select network
    const networkId = await select({
      message: 'Select network type:',
      choices: NETWORK_CHOICES,
    });

    // Step 2: Get currencies
    const sourceCurrency = await input({
      message: 'Enter source currency:',
      default: 'USD',
    });

    const destCurrency = await input({
      message: 'Enter destination currency:',
      default: networkId === 'polygon-usdc' ? 'USDC' : 'PHP',
    });

    const amountStr = await input({
      message: 'Enter amount:',
      default: '100',
    });
    const amount = parseFloat(amountStr);

    // Step 3: Create quote
    const spinner = ora('Creating quote...').start();
    let quote: Quote;
    try {
      quote = await client.quotes.create({
        networkId,
        sourceCurrency,
        destCurrency,
        amount,
        amountType: 'SOURCE',
      });
      spinner.succeed('Quote created');
      display.printQuote(quote);
    } catch (error) {
      spinner.fail('Failed to create quote');
      throw error;
    }

    // Step 4: Confirm quote
    const proceedWithPayment = await confirm({
      message: 'Proceed with payment?',
      default: true,
    });

    if (!proceedWithPayment) {
      display.printInfo('Payment cancelled by user');
      return;
    }

    // Step 5: Get sender/receiver details
    const senderFirstName = await input({ message: 'Sender first name:', default: 'John' });
    const senderLastName = await input({ message: 'Sender last name:', default: 'Doe' });

    const receiverFirstName = await input({ message: 'Receiver first name:', default: 'Jane' });
    const receiverLastName = await input({ message: 'Receiver last name:', default: 'Smith' });
    const receiverWallet = await input({
      message: 'Receiver wallet/account:',
      default: '0x1234567890abcdef1234567890abcdef12345678',
    });

    // Step 6: Create payment
    const paymentSpinner = ora('Creating payment...').start();
    let payment: Payment;
    try {
      payment = await client.payments.create({
        quoteId: quote.id,
        payerId: `payer_${networkId.replace('-', '_')}`,
        sender: { firstName: senderFirstName, lastName: senderLastName },
        receiver: {
          firstName: receiverFirstName,
          lastName: receiverLastName,
          walletAddress: receiverWallet
        },
      });
      paymentSpinner.succeed('Payment created');
      display.printPayment(payment);
    } catch (error) {
      paymentSpinner.fail('Failed to create payment');
      throw error;
    }

    // Step 7: Confirm payment
    const confirmPaymentChoice = await confirm({
      message: 'Confirm payment for execution?',
      default: true,
    });

    if (!confirmPaymentChoice) {
      const cancelSpinner = ora('Cancelling payment...').start();
      await client.payments.cancel(payment.id);
      cancelSpinner.succeed('Payment cancelled');
      return;
    }

    const confirmSpinner = ora('Submitting to network...').start();
    try {
      payment = await client.payments.confirm(payment.id);
      confirmSpinner.succeed('Payment confirmed');
      display.printPayment(payment);
    } catch (error) {
      confirmSpinner.fail('Failed to confirm payment');
      throw error;
    }

    // Step 8: Poll for completion
    const pollSpinner = ora('Waiting for completion...').start();
    let attempts = 0;
    const maxAttempts = 10;

    while (payment.status !== 'COMPLETED' && payment.status !== 'FAILED' && attempts < maxAttempts) {
      await sleep(2000);
      payment = await client.payments.get(payment.id);
      pollSpinner.text = `Waiting for completion... (${payment.status})`;
      attempts++;
    }

    if (payment.status === 'COMPLETED') {
      pollSpinner.succeed('Payment completed!');
    } else if (payment.status === 'FAILED') {
      pollSpinner.fail('Payment failed');
    } else {
      pollSpinner.warn('Timeout waiting for completion');
    }

    display.printPayment(payment);

    // Step 9: Show event history
    const events = await client.payments.listEvents(payment.id);
    display.printEvents(events);

  } catch (error) {
    if (error instanceof Error) {
      display.printError(error.message);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
