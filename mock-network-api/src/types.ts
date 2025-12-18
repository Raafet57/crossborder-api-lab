export interface PayerCurrencyPair {
  source_currency: string;
  dest_currency: string;
}

export interface Payer {
  id: string;
  name: string;
  country: string;
  currency_pairs: PayerCurrencyPair[];
  required_fields: string[];
  min_amount: number;
  max_amount: number;
}

export type QuoteMode = "SOURCE" | "DEST";

export interface Quote {
  id: string;
  payer_id: string;
  source_amount: number;
  source_currency: string;
  dest_currency: string;
  mode: QuoteMode;
  fx_rate: number;
  fee: number;
  dest_amount: number;
  expires_at: string;
  created_at: string;
}

export type TransactionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "REJECTED";

export interface Transaction {
  id: string;
  quote_id: string;
  payer_id: string;
  external_id: string;
  sender: Record<string, unknown>;
  receiver: Record<string, unknown>;
  purpose: string;
  status: TransactionStatus;
  rejection_reason?: {
    code: string;
    message?: string;
  };
  created_at: string;
  updated_at: string;
}
