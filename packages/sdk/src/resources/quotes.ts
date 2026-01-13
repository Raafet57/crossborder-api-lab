import type { Quote, CreateQuoteRequest } from '../types';

export class QuotesResource {
  constructor(
    private request: <T>(method: string, path: string, body?: unknown) => Promise<T>
  ) {}

  async create(data: CreateQuoteRequest): Promise<Quote> {
    return this.request<Quote>('POST', '/v1/quotes', data);
  }

  async get(quoteId: string): Promise<Quote> {
    return this.request<Quote>('GET', `/v1/quotes/${quoteId}`);
  }
}
