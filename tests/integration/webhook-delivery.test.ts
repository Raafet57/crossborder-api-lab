import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import http from 'http';
import { WebhookDispatcher } from '@crossborder/webhook-service';

describe('Webhook Delivery', () => {
  let mockServer: http.Server;
  let receivedWebhooks: any[] = [];
  let serverPort: number;

  beforeAll(async () => {
    // Create mock webhook receiver
    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        receivedWebhooks.push({
          headers: req.headers,
          body: JSON.parse(body),
        });

        // Simulate different responses
        if (body.includes('fail_500')) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200);
          res.end('OK');
        }
      });
    });

    await new Promise<void>(resolve => {
      mockServer.listen(0, () => {
        serverPort = (mockServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => mockServer.close(() => resolve()));
  });

  beforeEach(() => {
    receivedWebhooks = [];
  });

  it('delivers webhook to registered URL', async () => {
    const dispatcher = new WebhookDispatcher();

    await dispatcher.dispatch({
      url: `http://localhost:${serverPort}/webhook`,
      event: {
        id: 'evt_123',
        type: 'payment.completed',
        data: { paymentId: 'pay_123' },
      },
      secret: 'test_secret',
    });

    expect(receivedWebhooks).toHaveLength(1);
    expect(receivedWebhooks[0].body.type).toBe('payment.completed');
  });

  it('includes correct signature header', async () => {
    const dispatcher = new WebhookDispatcher();

    await dispatcher.dispatch({
      url: `http://localhost:${serverPort}/webhook`,
      event: { id: 'evt_123', type: 'payment.created', data: {} },
      secret: 'test_secret',
    });

    expect(receivedWebhooks[0].headers['x-webhook-signature']).toMatch(/t=\d+,v1=[a-f0-9]+/);
  });

  it('retries on 5xx response', async () => {
    const dispatcher = new WebhookDispatcher({ maxRetries: 2, baseDelayMs: 10 });

    await dispatcher.dispatch({
      url: `http://localhost:${serverPort}/webhook`,
      event: { id: 'evt_fail', type: 'fail_500', data: {} },
      secret: 'test_secret',
    });

    // Should have attempted multiple times
    expect(receivedWebhooks.length).toBeGreaterThan(1);
  });

  it('gives up after max retries', async () => {
    const dispatcher = new WebhookDispatcher({ maxRetries: 2, baseDelayMs: 10 });

    const result = await dispatcher.dispatch({
      url: `http://localhost:${serverPort}/webhook`,
      event: { id: 'evt_fail', type: 'fail_500', data: {} },
      secret: 'test_secret',
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // Initial + 2 retries
  });
});
