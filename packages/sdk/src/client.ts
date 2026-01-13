import * as crypto from 'crypto';
import { ClientConfig, DEFAULT_CONFIG } from './config';
import {
  CrossBorderError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './errors';
import { NetworksResource } from './resources/networks';
import { QuotesResource } from './resources/quotes';
import { PaymentsResource } from './resources/payments';
import { WebhooksResource } from './resources/webhooks';
import type { ErrorResponse } from './types';

export class CrossBorderClient {
  private config: Required<ClientConfig>;

  public readonly networks: NetworksResource;
  public readonly quotes: QuotesResource;
  public readonly payments: PaymentsResource;
  public readonly webhooks: WebhooksResource;

  constructor(config: ClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const boundRequest = this.request.bind(this);
    this.networks = new NetworksResource(boundRequest);
    this.quotes = new QuotesResource(boundRequest);
    this.payments = new PaymentsResource(boundRequest);
    this.webhooks = new WebhooksResource(boundRequest);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    useWebhookService: boolean = false
  ): Promise<T> {
    const baseUrl = useWebhookService ? this.config.webhookBaseUrl : this.config.baseUrl;
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Client-Id': this.config.clientId,
    };

    if (method === 'POST' || method === 'PUT') {
      headers['Idempotency-Key'] = crypto.randomUUID();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CrossBorderError) {
        throw error;
      }
      throw new CrossBorderError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed',
        0
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: ErrorResponse;
    try {
      errorBody = await response.json() as ErrorResponse;
    } catch {
      errorBody = { code: 'UNKNOWN', message: response.statusText };
    }

    switch (response.status) {
      case 400:
        throw new ValidationError(errorBody.message, errorBody.details);
      case 401:
        throw new AuthenticationError(errorBody.message);
      case 404:
        throw new NotFoundError('Resource', 'unknown');
      case 429:
        throw new RateLimitError();
      default:
        throw new CrossBorderError(
          errorBody.code,
          errorBody.message,
          response.status,
          errorBody.details
        );
    }
  }

  static verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = timestampPart.slice(2);
    const expectedSignature = signaturePart.slice(3);

    const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
    const signedPayload = `${timestamp}.${payloadStr}`;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }
}
