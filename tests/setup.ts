// Global test setup
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test_secret_key_for_testing';
process.env.WEBHOOK_SECRET = 'whsec_test_secret';

// Suppress console output during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});
