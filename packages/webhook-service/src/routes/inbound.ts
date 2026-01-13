import { Router, Request, Response, NextFunction } from 'express';
import { EventStore, createPaymentEvent } from '@crossborder/core';
import { parseStripeEvent } from '../handlers/stripe';
import { parseMpesaCallback, parseGcashCallback } from '../handlers/mpesa';
import { WebhookDispatcher } from '../dispatcher/dispatcher';

export function createInboundRouter(
  eventStore: EventStore,
  dispatcher: WebhookDispatcher
): Router {
  const router = Router();

  // Stripe webhooks
  router.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      const rawBody = req.body;
      const event = parseStripeEvent(rawBody, signature);

      if (!event) {
        res.status(400).json({ error: 'Invalid signature or unsupported event' });
        return;
      }

      console.log(JSON.stringify({
        type: 'inbound_stripe',
        networkPaymentId: event.networkPaymentId,
        status: event.status,
      }));

      if (event.data.paymentId) {
        const paymentEvent = createPaymentEvent(
          event.data.paymentId as string,
          event.status === 'CONFIRMED' ? 'PaymentConfirmed' :
          event.status === 'FAILED' ? 'PaymentFailed' : 'PaymentSubmitted',
          event.data,
          `stripe-${event.networkPaymentId}`
        );

        eventStore.append(paymentEvent);
        await dispatcher.dispatch(paymentEvent);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });

  // M-Pesa callbacks
  router.post('/mpesa', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = parseMpesaCallback(req.body);

      if (!event) {
        res.status(400).json({ error: 'Invalid callback format' });
        return;
      }

      console.log(JSON.stringify({
        type: 'inbound_mpesa',
        networkPaymentId: event.networkPaymentId,
        status: event.status,
      }));

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });

  // GCash callbacks
  router.post('/gcash', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = parseGcashCallback(req.body);

      console.log(JSON.stringify({
        type: 'inbound_gcash',
        networkPaymentId: event.networkPaymentId,
        status: event.status,
      }));

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
