import type {
  WebhookSubscription,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ListResponse,
} from '../types';

export class WebhooksResource {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
      useWebhookService?: boolean
    ) => Promise<T>
  ) {}

  async list(): Promise<WebhookSubscription[]> {
    const response = await this.request<ListResponse<WebhookSubscription>>(
      'GET',
      '/v1/webhooks',
      undefined,
      true
    );
    return response.data;
  }

  async create(data: CreateWebhookRequest): Promise<WebhookSubscription> {
    return this.request<WebhookSubscription>('POST', '/v1/webhooks', data, true);
  }

  async get(subscriptionId: string): Promise<WebhookSubscription> {
    return this.request<WebhookSubscription>(
      'GET',
      `/v1/webhooks/${subscriptionId}`,
      undefined,
      true
    );
  }

  async update(
    subscriptionId: string,
    data: UpdateWebhookRequest
  ): Promise<WebhookSubscription> {
    return this.request<WebhookSubscription>(
      'PUT',
      `/v1/webhooks/${subscriptionId}`,
      data,
      true
    );
  }

  async delete(subscriptionId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/webhooks/${subscriptionId}`, undefined, true);
  }
}
