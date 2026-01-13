/** Standard API error codes */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED = 'RATE_LIMITED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',

  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  COMPLIANCE_REJECTED = 'COMPLIANCE_REJECTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/** HTTP status code mapping */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.IDEMPOTENCY_CONFLICT]: 409,
  [ErrorCode.QUOTE_EXPIRED]: 422,
  [ErrorCode.INVALID_SIGNATURE]: 401,
  [ErrorCode.PAYMENT_FAILED]: 422,
  [ErrorCode.PAYMENT_CANCELLED]: 422,
  [ErrorCode.COMPLIANCE_REJECTED]: 422,
  [ErrorCode.NETWORK_ERROR]: 502,
  [ErrorCode.INSUFFICIENT_FUNDS]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/** API error response structure */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/** Custom error class */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  get statusCode(): number {
    return ERROR_STATUS_MAP[this.code];
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
