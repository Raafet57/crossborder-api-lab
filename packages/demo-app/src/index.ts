import { select } from '@inquirer/prompts';
import { CrossBorderClient } from '@crossborder/sdk';
import { runInteractive } from './interactive.js';
import { runScenarios, listScenarios } from './scenarios.js';
import * as display from './display.js';

const API_KEY = process.env.API_KEY || 'demo_key';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:4002';

async function main(): Promise<void> {
  const client = new CrossBorderClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    webhookBaseUrl: WEBHOOK_URL,
    clientId: 'demo-client',
  });

  display.printHeader();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const mode = await select({
      message: 'Select mode:',
      choices: [
        { name: 'Interactive - Walk through a payment flow', value: 'interactive' },
        { name: 'Scenarios - Run predefined test cases', value: 'scenarios' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    if (mode === 'exit') {
      console.log('\nGoodbye!\n');
      break;
    }

    if (mode === 'interactive') {
      await runInteractive(client);
    } else if (mode === 'scenarios') {
      const scenarioList = listScenarios();
      const scenarioChoice = await select({
        message: 'Select scenario:',
        choices: [
          ...scenarioList.map(s => ({ name: `${s.name} - ${s.description}`, value: s.name })),
          { name: 'All Scenarios - Run all tests', value: 'all' },
          { name: 'Back', value: 'back' },
        ],
      });

      if (scenarioChoice === 'back') {
        continue;
      }

      if (scenarioChoice === 'all') {
        await runScenarios(client);
      } else {
        await runScenarios(client, [scenarioChoice]);
      }
    }
  }
}

main().catch(console.error);
