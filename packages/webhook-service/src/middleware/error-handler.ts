import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.log(JSON.stringify({
    type: 'error',
    error: {
      name: err.name,
      message: err.message,
    },
  }));

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
}
