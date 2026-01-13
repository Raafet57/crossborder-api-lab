/**
 * Core domain types for cross-border payments API
 */

/** Supported payment network types */
export type NetworkType = 'stablecoin' | 'mobile_wallet' | 'card' | 'tokenized_asset';

/** Currency pair supported by a network */
export interface CurrencyPair {
  source: string;
  dest: string;
}

/** Required field definition for a network */
export interface RequiredField {
  path: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
}

/** Network amount limits */
export interface NetworkLimits {
  min: number;
  max: number;
}

/** Configuration for a payment network */
export interface NetworkConfig {
  id: string;
  type: NetworkType;
  displayName: string;
  supportedCurrencies: CurrencyPair[];
  requiredFields: RequiredField[];
  limits: NetworkLimits;
}

/** FX quote for a payment */
export interface Quote {
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

/** Payment status states */
export type PaymentStatus =
  | 'CREATED'
  | 'QUOTE_LOCKED'
  | 'COMPLIANCE_CHECK'
  | 'PENDING_NETWORK'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'SETTLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** Payment entity */
export interface Payment {
  id: string;
  externalId: string;
  quoteId: string;
  networkId: string;
  status: PaymentStatus;
  sourceAmount: number;
  sourceCurrency: string;
  destAmount: number;
  destCurrency: string;
  sender: Record<string, unknown>;
  receiver: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
