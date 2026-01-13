import { Router, Request, Response, NextFunction } from 'express';
import { orchestrator } from '../../services/orchestrator';
import { requireScope } from '../../middleware/auth';
import { signatureMiddleware } from '../../middleware/request-signature';
import {
  CreatePaymentRequest,
  PaymentEventResponse,
  CancelPaymentRequest,
} from '../../types/api';
import { AppError, ErrorCode } from '../../types/errors';

const router = Router();

router.post(
  '/',
  requireScope('payments:write'),
  signatureMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: CreatePaymentRequest = req.body;

      if (!body.quoteId) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'quoteId is required');
      }
      if (!body.sender?.firstName || !body.sender?.lastName) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'sender.firstName and sender.lastName are required');
      }

      const payment = await orchestrator.createPayment(body, req.correlationId);
      const response = orchestrator.getPaymentStore().toResponse(payment);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  requireScope('payments:read'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = orchestrator.getPayment(req.params.id);
      const response = orchestrator.getPaymentStore().toResponse(payment);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/confirm',
  requireScope('payments:write'),
  signatureMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await orchestrator.confirmPayment(req.params.id, req.correlationId);
      const response = orchestrator.getPaymentStore().toResponse(payment);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/cancel',
  requireScope('payments:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: CancelPaymentRequest = req.body;
      const payment = await orchestrator.cancelPayment(req.params.id, body.reason, req.correlationId);
      const response = orchestrator.getPaymentStore().toResponse(payment);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/events',
  requireScope('payments:read'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = orchestrator.getPaymentEvents(req.params.id);

      const response: PaymentEventResponse[] = events.map(e => ({
        id: e.id,
        paymentId: e.paymentId,
        type: e.type,
        data: e.data,
        timestamp: e.timestamp,
      }));

      res.json({ data: response });
    } catch (error) {
      next(error);
    }
  }
);

export const paymentsRouter = router;
