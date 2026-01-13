import type { Network, Payer, ListResponse } from '../types';

export class NetworksResource {
  constructor(private request: <T>(method: string, path: string) => Promise<T>) {}

  async list(): Promise<Network[]> {
    const response = await this.request<ListResponse<Network>>('GET', '/v1/networks');
    return response.data;
  }

  async listPayers(networkId: string): Promise<Payer[]> {
    const response = await this.request<ListResponse<Payer>>(
      'GET',
      `/v1/networks/${networkId}/payers`
    );
    return response.data;
  }
}
