export class CrossBorderError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CrossBorderError';
  }
}

export class ValidationError extends CrossBorderError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends CrossBorderError {
  constructor(message: string = 'Authentication failed') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends CrossBorderError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends CrossBorderError {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}
