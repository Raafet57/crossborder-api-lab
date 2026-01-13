export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  webhookBaseUrl?: string;
  timeout?: number;
  clientId?: string;
}

export const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:4000',
  webhookBaseUrl: 'http://localhost:4002',
  timeout: 30000,
  clientId: 'default-client',
};
