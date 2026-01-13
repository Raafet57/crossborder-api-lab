import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import {
  authMiddleware,
  rateLimitMiddleware,
  correlationIdMiddleware,
  idempotencyMiddleware,
  auditLogMiddleware,
} from '@crossborder/api-gateway';

describe('authMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn() as NextFunction;
  });

  it('allows valid Bearer token', async () => {
    mockReq.headers = { authorization: 'Bearer valid_token' };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('allows valid API key', async () => {
    mockReq.headers = { 'x-api-key': 'valid_api_key' };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('rejects missing authorization', async () => {
    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('rejects invalid token', async () => {
    mockReq.headers = { authorization: 'Bearer invalid' };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});

describe('rateLimitMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: { 'x-api-key': 'test_key' },
      ip: '127.0.0.1',
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      set: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn() as NextFunction;
  });

  it('allows requests within limit', async () => {
    const middleware = rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 });

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('rejects requests exceeding limit', async () => {
    const middleware = rateLimitMiddleware({ maxRequests: 1, windowMs: 60000 });

    await middleware(mockReq as Request, mockRes as Response, mockNext);
    (mockNext as jest.Mock).mockClear();

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
  });
});

describe('correlationIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      set: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn() as NextFunction;
  });

  it('generates correlation ID if not present', () => {
    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq).toHaveProperty('correlationId');
    expect(mockRes.set).toHaveBeenCalledWith('X-Correlation-Id', expect.any(String));
  });

  it('uses provided X-Correlation-Id header', () => {
    mockReq.headers = { 'x-correlation-id': 'existing-id' };

    correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).correlationId).toBe('existing-id');
  });
});

describe('idempotencyMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      headers: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn() as NextFunction;
  });

  it('requires Idempotency-Key for POST requests', async () => {
    await idempotencyMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: expect.stringContaining('IDEMPOTENCY') })
    );
  });

  it('allows GET requests without key', async () => {
    mockReq.method = 'GET';

    await idempotencyMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('auditLogMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/v1/payments',
      headers: { 'x-correlation-id': 'corr_123' },
      body: {
        cardNumber: '4242424242424242',
        cvv: '123',
        sender: { firstName: 'John' },
      },
    };
    mockRes = {
      on: jest.fn() as any,
    };
    mockNext = jest.fn() as NextFunction;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('logs request details', () => {
    auditLogMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('masks sensitive fields (PCI compliance)', () => {
    auditLogMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).not.toContain('4242424242424242');
    expect(logCall).not.toContain('123');
  });

  it('includes correlation ID in logs', () => {
    auditLogMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toContain('corr_123');
  });
});
