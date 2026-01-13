import express, { Express, Request, Response, NextFunction } from 'express';
import { EventStore } from '@crossborder/core';
import { WebhookRegistry } from './dispatcher/registry';
import { WebhookDispatcher } from './dispatcher/dispatcher';
import { PolygonPoller } from './handlers/polygon-poller';
import { createSubscriptionsRouter } from './routes/subscriptions';
import { createInboundRouter } from './routes/inbound';
import { errorHandler } from './middleware/error-handler';

export interface WebhookServiceDependencies {
  eventStore: EventStore;
}

export interface WebhookServiceContext {
  app: Express;
  registry: WebhookRegistry;
  dispatcher: WebhookDispatcher;
  polygonPoller: PolygonPoller;
}

export function createWebhookApp(deps: WebhookServiceDependencies): WebhookServiceContext {
  const app = express();

  // Initialize components
  const registry = new WebhookRegistry();
  const dispatcher = new WebhookDispatcher(registry);
  const polygonPoller = new PolygonPoller(deps.eventStore);

  // Middleware - raw body for Stripe signature verification
  app.use('/inbound/stripe', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pendingPolygonTxs: polygonPoller.getPendingCount(),
    });
  });

  // Routes
  app.use('/v1/webhooks', createSubscriptionsRouter(registry, dispatcher));
  app.use('/inbound', createInboundRouter(deps.eventStore, dispatcher));

  // Internal endpoint - receive events from api-gateway
  app.post('/internal/dispatch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId, type, data, correlationId } = req.body;

      const event = {
        id: `evt_${Date.now()}`,
        paymentId,
        type,
        timestamp: new Date().toISOString(),
        data: data || {},
        correlationId: correlationId || 'internal',
      };

      await dispatcher.dispatch(event);
      res.json({ dispatched: true });
    } catch (error) {
      next(error);
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    });
  });

  // Error handler
  app.use(errorHandler);

  // Start polygon poller
  polygonPoller.start();

  return { app, registry, dispatcher, polygonPoller };
}
