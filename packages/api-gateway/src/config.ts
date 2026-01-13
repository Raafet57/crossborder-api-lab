export interface Config {
  port: number;
  env: 'development' | 'production' | 'test';

  // Auth
  apiKeys: Map<string, {
    clientId: string;
    secret: string;
    scopes: string[];
    rateLimit: { requestsPerMinute: number; requestsPerDay: number };
  }>;
  signatureSecret: string;
  signatureThreshold: number;

  // Network adapters
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  polygon: {
    rpcUrl: string;
    privateKey: string;
  };

  // Compliance
  compliance: {
    enabled: boolean;
    sanctionsListPath?: string;
  };
}

function parseApiKeys(envValue?: string): Config['apiKeys'] {
  const keys = new Map<string, {
    clientId: string;
    secret: string;
    scopes: string[];
    rateLimit: { requestsPerMinute: number; requestsPerDay: number };
  }>();

  // Default demo key for development
  keys.set('demo_key_12345', {
    clientId: 'demo-client',
    secret: 'demo_secret',
    scopes: ['payments:read', 'payments:write', 'quotes:read', 'quotes:write'],
    rateLimit: { requestsPerMinute: 60, requestsPerDay: 1000 },
  });

  // Parse additional keys from env if provided (JSON format)
  if (envValue) {
    try {
      const parsed = JSON.parse(envValue);
      for (const [key, value] of Object.entries(parsed)) {
        keys.set(key, value as typeof keys extends Map<string, infer V> ? V : never);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return keys;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '4000', 10),
    env: (process.env.NODE_ENV as Config['env']) || 'development',

    apiKeys: parseApiKeys(process.env.API_KEYS),
    signatureSecret: process.env.SIGNATURE_SECRET || 'dev_signature_secret',
    signatureThreshold: parseInt(process.env.SIGNATURE_THRESHOLD || '10000', 10),

    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    polygon: {
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
      privateKey: process.env.POLYGON_PRIVATE_KEY || '',
    },

    compliance: {
      enabled: process.env.COMPLIANCE_ENABLED !== 'false',
      sanctionsListPath: process.env.SANCTIONS_LIST_PATH,
    },
  };
}

export const config = loadConfig();
