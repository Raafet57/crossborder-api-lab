import { PaymentStatus, NetworkType } from '@crossborder/core';

/** Pagination params */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ============ Networks ============

export interface NetworkResponse {
  id: string;
  type: NetworkType;
  displayName: string;
  supportedCurrencies: Array<{ source: string; dest: string }>;
  limits: { min: number; max: number };
}

export interface PayerResponse {
  networkId: string;
  requiredFields: Array<{
    path: string;
    type: string;
    description: string;
  }>;
}

// ============ Quotes ============

export interface CreateQuoteRequest {
  networkId: string;
  sourceAmount?: number;
  destAmount?: number;
  sourceCurrency: string;
  destCurrency: string;
}

export interface QuoteResponse {
  id: string;
  networkId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  fxRate: number;
  fee: number;
  expiresAt: string;
  createdAt: string;
}

// ============ Payments ============

export interface SenderInfo {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  dateOfBirth?: string;
}

export interface ReceiverInfo {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  walletAddress?: string;
  bankAccount?: string;
  bankCode?: string;
  email?: string;
}

export interface CreatePaymentRequest {
  quoteId: string;
  externalId?: string;
  sender: SenderInfo;
  receiver: ReceiverInfo;
  purpose?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResponse {
  id: string;
  externalId?: string;
  quoteId: string;
  networkId: string;
  status: PaymentStatus;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  fee: number;
  fxRate: number;
  sender: SenderInfo;
  receiver: ReceiverInfo;
  purpose?: string;
  metadata?: Record<string, string>;
  networkPaymentId?: string;
  requiresAction?: {
    type: 'REDIRECT' | 'OTP' | 'CONFIRMATION';
    url?: string;
    message?: string;
  };
  complianceStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  complianceDetails?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventResponse {
  id: string;
  paymentId: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ConfirmPaymentRequest {
  confirmationCode?: string;
}

export interface CancelPaymentRequest {
  reason?: string;
}

// ============ Auth Context ============

export interface AuthContext {
  apiKeyId: string;
  clientId: string;
  scopes: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}
