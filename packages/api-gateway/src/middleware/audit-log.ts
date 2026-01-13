import { Request, Response, NextFunction } from 'express';

interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  clientId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  ip: string;
  userAgent?: string;
}

const SENSITIVE_FIELDS = [
  'cardNumber', 'cvv', 'cvc', 'pin',
  'password', 'secret', 'token', 'apiKey',
  'ssn', 'socialSecurityNumber',
  'bankAccount', 'accountNumber', 'routingNumber',
  'privateKey',
];

const PII_FIELDS = [
  'email', 'phone', 'dateOfBirth', 'dob',
  'address', 'streetAddress',
  'firstName', 'lastName', 'fullName',
];

export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  const originalJson = res.json.bind(res);
  let responseBody: Record<string, unknown> | undefined;

  res.json = (body: unknown) => {
    responseBody = body as Record<string, unknown>;
    return originalJson(body);
  };

  res.on('finish', () => {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      clientId: req.auth?.clientId || 'anonymous',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
      requestBody: maskSensitiveData(req.body),
      responseBody: maskSensitiveData(responseBody),
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
    };

    console.log(JSON.stringify({ type: 'audit', ...entry }));
  });

  next();
}

function maskSensitiveData(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (PII_FIELDS.some(f => lowerKey.includes(f.toLowerCase()))) {
      masked[key] = maskPII(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

function maskPII(value: unknown): string {
  if (typeof value !== 'string') {
    return '[MASKED]';
  }

  if (value.length <= 4) {
    return '****';
  }

  return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
}
