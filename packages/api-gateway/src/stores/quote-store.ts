import { v4 as uuidv4 } from 'uuid';
import { NetworkQuote } from '@crossborder/network-adapters';

export interface StoredQuote {
  id: string;
  networkId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  fxRate: number;
  fee: number;
  expiresAt: Date;
  createdAt: Date;
  networkMetadata?: Record<string, unknown>;
}

export class QuoteStore {
  private quotes = new Map<string, StoredQuote>();

  create(networkQuote: NetworkQuote): StoredQuote {
    const quote: StoredQuote = {
      id: uuidv4(),
      networkId: networkQuote.networkId,
      sourceAmount: networkQuote.sourceAmount,
      sourceCurrency: networkQuote.sourceCurrency,
      destAmount: networkQuote.destAmount,
      destCurrency: networkQuote.destCurrency,
      fxRate: networkQuote.fxRate,
      fee: networkQuote.fee,
      expiresAt: new Date(networkQuote.expiresAt),
      createdAt: new Date(),
      networkMetadata: networkQuote.networkMetadata,
    };

    this.quotes.set(quote.id, quote);
    return quote;
  }

  get(id: string): StoredQuote | undefined {
    return this.quotes.get(id);
  }

  isExpired(quote: StoredQuote): boolean {
    return new Date() > quote.expiresAt;
  }

  delete(id: string): boolean {
    return this.quotes.delete(id);
  }

  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, quote] of this.quotes.entries()) {
      if (now > quote.expiresAt) {
        this.quotes.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export const quoteStore = new QuoteStore();

setInterval(() => quoteStore.cleanup(), 5 * 60 * 1000);
