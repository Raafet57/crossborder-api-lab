import type { Payment, PaymentEvent, CreatePaymentRequest, ListResponse } from '../types';

export class PaymentsResource {
  constructor(
    private request: <T>(method: string, path: string, body?: unknown) => Promise<T>
  ) {}

  async create(data: CreatePaymentRequest): Promise<Payment> {
    return this.request<Payment>('POST', '/v1/payments', data);
  }

  async get(paymentId: string): Promise<Payment> {
    return this.request<Payment>('GET', `/v1/payments/${paymentId}`);
  }

  async confirm(paymentId: string): Promise<Payment> {
    return this.request<Payment>('POST', `/v1/payments/${paymentId}/confirm`);
  }

  async cancel(paymentId: string): Promise<Payment> {
    return this.request<Payment>('POST', `/v1/payments/${paymentId}/cancel`);
  }

  async listEvents(paymentId: string): Promise<PaymentEvent[]> {
    const response = await this.request<ListResponse<PaymentEvent>>(
      'GET',
      `/v1/payments/${paymentId}/events`
    );
    return response.data;
  }
}
