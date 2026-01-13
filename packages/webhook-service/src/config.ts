export interface WebhookServiceConfig {
  port: number;

  dispatcher: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    timeoutMs: number;
  };

  stripe: {
    webhookSecret: string;
  };

  polygon: {
    confirmationsRequired: number;
    pollIntervalMs: number;
  };

  internalSecret: string;
}

export function loadConfig(): WebhookServiceConfig {
  return {
    port: parseInt(process.env.WEBHOOK_PORT || '4002', 10),

    dispatcher: {
      maxRetries: 6,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      timeoutMs: 30000,
    },

    stripe: {
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test',
    },

    polygon: {
      confirmationsRequired: parseInt(process.env.POLYGON_CONFIRMATIONS || '12', 10),
      pollIntervalMs: parseInt(process.env.POLYGON_POLL_INTERVAL || '15000', 10),
    },

    internalSecret: process.env.INTERNAL_SECRET || 'internal_dev_secret',
  };
}

export const config = loadConfig();
