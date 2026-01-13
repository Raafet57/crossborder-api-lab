import ora from 'ora';
import { CrossBorderClient } from '@crossborder/sdk';
import * as display from './display.js';

interface ScenarioResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

type Scenario = {
  name: string;
  description: string;
  run: (client: CrossBorderClient) => Promise<void>;
};

const scenarios: Scenario[] = [
  {
    name: 'happy_path',
    description: 'Complete payment flow',
    run: async (client) => {
      const quote = await client.quotes.create({
        networkId: 'polygon-usdc',
        sourceCurrency: 'USD',
        destCurrency: 'USDC',
        amount: 100,
        amountType: 'SOURCE',
      });
      if (!quote.id) throw new Error('Quote creation failed');

      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: 'payer_polygon_usdc',
        sender: { firstName: 'Test', lastName: 'Sender' },
        receiver: { firstName: 'Test', lastName: 'Receiver', walletAddress: '0x1234' },
      });
      if (!payment.id) throw new Error('Payment creation failed');

      const confirmed = await client.payments.confirm(payment.id);
      if (confirmed.status !== 'SUBMITTED' && confirmed.status !== 'CONFIRMED') {
        throw new Error(`Unexpected status after confirm: ${confirmed.status}`);
      }

      const events = await client.payments.listEvents(payment.id);
      if (events.length === 0) throw new Error('No events found');
    },
  },
  {
    name: 'quote_retrieval',
    description: 'Create and retrieve quote',
    run: async (client) => {
      const quote = await client.quotes.create({
        networkId: 'stripe',
        sourceCurrency: 'USD',
        destCurrency: 'PHP',
        amount: 50,
        amountType: 'SOURCE',
      });

      const retrieved = await client.quotes.get(quote.id);
      if (retrieved.id !== quote.id) {
        throw new Error('Retrieved quote ID mismatch');
      }
    },
  },
  {
    name: 'payment_cancellation',
    description: 'Create and cancel payment',
    run: async (client) => {
      const quote = await client.quotes.create({
        networkId: 'mpesa',
        sourceCurrency: 'USD',
        destCurrency: 'KES',
        amount: 25,
        amountType: 'SOURCE',
      });

      const payment = await client.payments.create({
        quoteId: quote.id,
        payerId: 'payer_mpesa',
        sender: { firstName: 'Cancel', lastName: 'Test' },
        receiver: { firstName: 'Receiver', lastName: 'Test', phone: '+254700000000' },
      });

      const cancelled = await client.payments.cancel(payment.id);
      if (cancelled.status !== 'CANCELLED') {
        throw new Error(`Expected CANCELLED, got: ${cancelled.status}`);
      }
    },
  },
  {
    name: 'network_discovery',
    description: 'List networks and payers',
    run: async (client) => {
      const networks = await client.networks.list();
      if (networks.length === 0) throw new Error('No networks found');

      const payers = await client.networks.listPayers(networks[0].id);
      if (payers.length === 0) throw new Error('No payers found');
    },
  },
  {
    name: 'webhook_lifecycle',
    description: 'Create, update, delete webhook',
    run: async (client) => {
      const subscription = await client.webhooks.create({
        url: 'https://example.com/webhook-test',
        events: ['payment.created'],
      });
      if (!subscription.id) throw new Error('Webhook creation failed');

      const updated = await client.webhooks.update(subscription.id, {
        events: ['payment.created', 'payment.completed'],
      });
      if (updated.events.length !== 2) throw new Error('Webhook update failed');

      await client.webhooks.delete(subscription.id);
    },
  },
];

export async function runScenarios(client: CrossBorderClient, scenarioNames?: string[]): Promise<void> {
  display.printHeader();
  console.log('Scenario Mode - Running predefined test cases\n');

  const toRun = scenarioNames
    ? scenarios.filter(s => scenarioNames.includes(s.name))
    : scenarios;

  const results: ScenarioResult[] = [];

  for (const scenario of toRun) {
    console.log(`Running: ${scenario.description}`);
    console.log('─'.repeat(40));

    const spinner = ora('Executing...').start();
    const start = Date.now();

    try {
      await scenario.run(client);
      const duration = Date.now() - start;
      spinner.succeed('Completed');
      results.push({ name: scenario.name, passed: true, duration });
      display.printScenarioResult(scenario.name, true, duration);
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      spinner.fail(errorMsg);
      results.push({ name: scenario.name, passed: false, duration, error: errorMsg });
      display.printScenarioResult(scenario.name, false, duration);
    }
  }

  const passed = results.filter(r => r.passed).length;
  display.printSummary(passed, results.length);
}

export function listScenarios(): { name: string; description: string }[] {
  return scenarios.map(s => ({ name: s.name, description: s.description }));
}
