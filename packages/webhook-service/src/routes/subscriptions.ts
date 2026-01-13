import { Router, Request, Response, NextFunction } from 'express';
import { WebhookRegistry } from '../dispatcher/registry';
import { WebhookDispatcher } from '../dispatcher/dispatcher';
import { CreateSubscriptionRequest, UpdateSubscriptionRequest } from '../types';

export function createSubscriptionsRouter(
  registry: WebhookRegistry,
  dispatcher: WebhookDispatcher
): Router {
  const router = Router();

  // Create subscription
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.headers['x-client-id'] as string || 'anonymous';
      const body: CreateSubscriptionRequest = req.body;

      if (!body.url || !body.secret || !body.events) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'url, secret, and events are required',
        });
        return;
      }

      const subscription = registry.create(clientId, body);
      res.status(201).json(subscription);
    } catch (error) {
      next(error);
    }
  });

  // List subscriptions for client
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.headers['x-client-id'] as string || 'anonymous';
      const subscriptions = registry.getByClientId(clientId);
      res.json({ data: subscriptions });
    } catch (error) {
      next(error);
    }
  });

  // Get subscription by ID
  router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = registry.get(req.params.id);
      if (!subscription) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }
      res.json(subscription);
    } catch (error) {
      next(error);
    }
  });

  // Update subscription
  router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: UpdateSubscriptionRequest = req.body;
      const subscription = registry.update(req.params.id, body);

      if (!subscription) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }

      res.json(subscription);
    } catch (error) {
      next(error);
    }
  });

  // Delete subscription
  router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = registry.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Get delivery history
  router.get('/:id/deliveries', (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = registry.get(req.params.id);
      if (!subscription) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = registry.getDeliveries(req.params.id, limit);
      res.json({ data: deliveries });
    } catch (error) {
      next(error);
    }
  });

  // Send test webhook
  router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = registry.get(req.params.id);
      if (!subscription) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
        return;
      }

      const attempt = await dispatcher.sendTest(req.params.id);
      res.json(attempt || { status: 'dispatched' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
