import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError, ErrorCode } from '../types/errors';
import { AuthContext } from '../types/api';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Missing API key');
    }

    const keyConfig = config.apiKeys.get(apiKey);

    if (!keyConfig) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid API key');
    }

    req.auth = {
      apiKeyId: apiKey,
      clientId: keyConfig.clientId,
      scopes: keyConfig.scopes,
      rateLimit: keyConfig.rateLimit,
    };

    next();
  } catch (error) {
    next(error);
  }
}

function extractApiKey(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return undefined;
}

export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hasScope = requiredScopes.some(scope => req.auth.scopes.includes(scope));

    if (!hasScope) {
      next(new AppError(
        ErrorCode.FORBIDDEN,
        `Missing required scope: ${requiredScopes.join(' or ')}`
      ));
      return;
    }

    next();
  };
}
