import express, { Express } from 'express';
import { v1Router } from './routes/v1';
import {
  correlationMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  auditLogMiddleware,
  errorHandler,
  notFoundHandler,
} from './middleware';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(correlationMiddleware);
  app.use(auditLogMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  });

  app.use('/v1', authMiddleware);
  app.use('/v1', rateLimitMiddleware);

  app.use('/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
