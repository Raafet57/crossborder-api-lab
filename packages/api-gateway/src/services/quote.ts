import { createNetworkAdapter, getAvailableNetworks, QuoteRequest } from '@crossborder/network-adapters';
import { quoteStore, StoredQuote } from '../stores/quote-store';
import { AppError, ErrorCode } from '../types/errors';
import { config } from '../config';

export interface CreateQuoteParams {
  networkId: string;
  sourceAmount?: number;
  destAmount?: number;
  sourceCurrency: string;
  destCurrency: string;
}

export class QuoteService {
  async createQuote(params: CreateQuoteParams): Promise<StoredQuote> {
    const networks = getAvailableNetworks();
    const network = networks.find(n => n.id === params.networkId);

    if (!network) {
      throw new AppError(ErrorCode.BAD_REQUEST, `Unknown network: ${params.networkId}`);
    }

    const validPair = network.supportedCurrencies.some(
      c => c.source === params.sourceCurrency && c.dest === params.destCurrency
    );

    if (!validPair) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        `Currency pair ${params.sourceCurrency}-${params.destCurrency} not supported for network ${params.networkId}`
      );
    }

    if (!params.sourceAmount && !params.destAmount) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Either sourceAmount or destAmount is required');
    }

    const amount = params.sourceAmount || params.destAmount!;

    if (amount < network.limits.min || amount > network.limits.max) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        `Amount must be between ${network.limits.min} and ${network.limits.max}`
      );
    }

    const adapter = this.getAdapter(params.networkId);

    const quoteRequest: QuoteRequest = {
      networkId: params.networkId,
      sourceAmount: params.sourceAmount || params.destAmount!,
      sourceCurrency: params.sourceCurrency,
      destCurrency: params.destCurrency,
      mode: params.sourceAmount ? 'SOURCE' : 'DESTINATION',
    };

    const networkQuote = await adapter.getQuote(quoteRequest);

    return quoteStore.create(networkQuote);
  }

  getQuote(id: string): StoredQuote {
    const quote = quoteStore.get(id);

    if (!quote) {
      throw new AppError(ErrorCode.NOT_FOUND, `Quote not found: ${id}`);
    }

    return quote;
  }

  validateQuote(id: string): StoredQuote {
    const quote = this.getQuote(id);

    if (quoteStore.isExpired(quote)) {
      throw new AppError(ErrorCode.QUOTE_EXPIRED, 'Quote has expired');
    }

    return quote;
  }

  private getAdapter(networkId: string) {
    return createNetworkAdapter(networkId, {
      stripeSecretKey: config.stripe.secretKey,
      stripeWebhookSecret: config.stripe.webhookSecret,
      polygonRpcUrl: config.polygon.rpcUrl,
      polygonPrivateKey: config.polygon.privateKey,
    });
  }
}

export const quoteService = new QuoteService();
