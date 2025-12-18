export type QuoteMode = "SOURCE" | "DEST";

export type Payer = {
  id: string;
  country: string;
  currency_pairs: Array<{ source_currency: string; dest_currency: string }>;
  required_fields: string[];
  min_amount: number;
  max_amount: number;
};

export type Quote = {
  id: string;
  fx_rate: number;
  fee: number;
  source_amount: number;
  dest_amount: number;
  expires_at: string;
};

export type TransactionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "REJECTED";

export type Transaction = {
  id: string;
  quote_id: string;
  payer_id: string;
  external_id: string;
  sender: Record<string, unknown>;
  receiver: Record<string, unknown>;
  purpose: string;
  status: TransactionStatus;
  rejection_reason?: { code: string; message?: string };
  created_at: string;
  updated_at: string;
};

export type WebhookEvent = {
  id: string;
  type: string;
  created_at: string;
  data: { transaction: Transaction };
};
