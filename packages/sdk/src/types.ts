// Network types
export interface Network {
  id: string;
  name: string;
  type: 'stablecoin' | 'card' | 'mobile_wallet' | 'tokenized_assets';
  currencies: string[];
  enabled: boolean;
}

export interface Payer {
  id: string;
  networkId: string;
  name: string;
  country: string;
  currency: string;
  requiredFields: string[];
}

// Quote types
export interface CreateQuoteRequest {
  networkId: string;
  sourceCurrency: string;
  destCurrency: string;
  amount: number;
  amountType: 'SOURCE' | 'DESTINATION';
}

export interface Quote {
  id: string;
  networkId: string;
  sourceCurrency: string;
  destCurrency: string;
  sourceAmount: number;
  destAmount: number;
  fxRate: number;
  fee: number;
  expiresAt: string;
  createdAt: string;
}

// Payment types
export interface Party {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    city?: string;
    country?: string;
  };
  bankAccount?: string;
  walletAddress?: string;
}

export interface CreatePaymentRequest {
  quoteId: string;
  payerId: string;
  externalId?: string;
  sender: Party;
  receiver: Party;
  purpose?: string;
}

export type PaymentStatus =
  | 'CREATED'
  | 'QUOTE_LOCKED'
  | 'COMPLIANCE_CHECK'
  | 'SUBMITTED'
  | 'PENDING_USER_ACTION'
  | 'CONFIRMED'
  | 'SETTLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface Payment {
  id: string;
  quoteId: string;
  networkId: string;
  payerId: string;
  externalId?: string;
  status: PaymentStatus;
  sourceAmount: number;
  destAmount: number;
  sourceCurrency: string;
  destCurrency: string;
  sender: Party;
  receiver: Party;
  networkPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  id: string;
  paymentId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  correlationId?: string;
}

// Webhook types
export interface CreateWebhookRequest {
  url: string;
  events: string[];
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  active?: boolean;
}

export interface WebhookSubscription {
  id: string;
  clientId: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Response wrappers
export interface ListResponse<T> {
  data: T[];
}

// Error response
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
