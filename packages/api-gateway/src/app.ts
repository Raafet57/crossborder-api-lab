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

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Idempotency-Key, X-Correlation-Id');
    res.header('Access-Control-Expose-Headers', 'X-Correlation-Id, X-RateLimit-Limit, X-RateLimit-Remaining');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

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
