// Global test setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test_secret_key_for_testing';
process.env.WEBHOOK_SECRET = 'whsec_test_secret';

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});
