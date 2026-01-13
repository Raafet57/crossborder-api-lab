import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ApiError } from '../types/errors';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(JSON.stringify({
    type: 'error',
    correlationId: req.correlationId,
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
  }));

  if (error instanceof AppError) {
    const response: ApiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId: req.correlationId,
    };

    res.status(error.statusCode).json(response);
    return;
  }

  if (error.name === 'ValidationError') {
    const response: ApiError = {
      code: ErrorCode.BAD_REQUEST,
      message: 'Validation failed',
      details: { errors: (error as { errors?: unknown }).errors },
      correlationId: req.correlationId,
    };

    res.status(400).json(response);
    return;
  }

  const response: ApiError = {
    code: ErrorCode.INTERNAL_ERROR,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
    correlationId: req.correlationId,
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiError = {
    code: ErrorCode.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    correlationId: req.correlationId,
  };

  res.status(404).json(response);
}
