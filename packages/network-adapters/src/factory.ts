import { NetworkConfig } from '@crossborder/core';
import { NetworkAdapter } from './interface';
import { StripeCardAdapter } from './adapters/card/stripe';
import { PolygonUSDCAdapter } from './adapters/stablecoin/polygon';
import { MPesaMockAdapter } from './adapters/mobile-wallet/mpesa';
import { GCashMockAdapter } from './adapters/mobile-wallet/gcash';
import { RWAMockAdapter } from './adapters/tokenized-assets/rwa';

/** Adapter configuration by network ID */
export interface AdapterConfig {
  // Stripe
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  // Polygon
  polygonRpcUrl?: string;
  polygonPrivateKey?: string;
}

/** All available network configurations */
const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    id: 'stripe-card',
    type: 'card',
    displayName: 'Card Payment (Stripe)',
    supportedCurrencies: [
      { source: 'USD', dest: 'USD' },
      { source: 'EUR', dest: 'EUR' },
      { source: 'GBP', dest: 'GBP' },
    ],
    requiredFields: [
      { path: 'sender.firstName', type: 'string', description: 'Cardholder first name' },
      { path: 'sender.lastName', type: 'string', description: 'Cardholder last name' },
      { path: 'sender.email', type: 'string', description: 'Cardholder email' },
    ],
    limits: { min: 0.5, max: 999999 },
  },
  {
    id: 'polygon-amoy-usdc',
    type: 'stablecoin',
    displayName: 'USDC on Polygon (Testnet)',
    supportedCurrencies: [{ source: 'USD', dest: 'USDC' }],
    requiredFields: [
      { path: 'receiver.walletAddress', type: 'string', description: 'Recipient wallet address (0x...)' },
    ],
    limits: { min: 1, max: 10000 },
  },
  {
    id: 'mpesa-kenya',
    type: 'mobile_wallet',
    displayName: 'M-Pesa Kenya',
    supportedCurrencies: [{ source: 'USD', dest: 'KES' }],
    requiredFields: [
      { path: 'receiver.phone', type: 'string', description: 'Recipient phone number (+254...)' },
      { path: 'receiver.firstName', type: 'string', description: 'Recipient first name' },
      { path: 'receiver.lastName', type: 'string', description: 'Recipient last name' },
    ],
    limits: { min: 1, max: 1000 },
  },
  {
    id: 'gcash-ph',
    type: 'mobile_wallet',
    displayName: 'GCash Philippines',
    supportedCurrencies: [{ source: 'USD', dest: 'PHP' }],
    requiredFields: [
      { path: 'receiver.phone', type: 'string', description: 'Recipient phone number (+63...)' },
      { path: 'receiver.firstName', type: 'string', description: 'Recipient first name' },
      { path: 'receiver.lastName', type: 'string', description: 'Recipient last name' },
    ],
    limits: { min: 1, max: 2000 },
  },
  {
    id: 'rwa-treasury',
    type: 'tokenized_asset',
    displayName: 'Tokenized US Treasury Bonds',
    supportedCurrencies: [{ source: 'USD', dest: 'TBOND' }],
    requiredFields: [
      { path: 'receiver.walletAddress', type: 'string', description: 'Custody wallet address' },
      { path: 'sender.kycVerified', type: 'boolean', description: 'KYC verification status' },
    ],
    limits: { min: 1000, max: 1000000 },
  },
];

/**
 * Get all available network configurations
 */
export function getAvailableNetworks(): NetworkConfig[] {
  return [...NETWORK_CONFIGS];
}

/**
 * Create a network adapter by ID
 * @param networkId - Network identifier
 * @param config - Adapter configuration (API keys, etc.)
 * @returns NetworkAdapter instance
 * @throws Error if network ID is unknown or required config is missing
 */
export function createNetworkAdapter(networkId: string, config: AdapterConfig = {}): NetworkAdapter {
  switch (networkId) {
    case 'stripe-card': {
      const secretKey = config.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw new Error('Stripe secret key required (config.stripeSecretKey or STRIPE_SECRET_KEY env)');
      }
      return new StripeCardAdapter({
        secretKey,
        webhookSecret: config.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET,
      });
    }

    case 'polygon-amoy-usdc': {
      const rpcUrl = config.polygonRpcUrl || process.env.POLYGON_RPC_URL;
      const privateKey = config.polygonPrivateKey || process.env.POLYGON_PRIVATE_KEY;
      if (!rpcUrl || !privateKey) {
        throw new Error('Polygon RPC URL and private key required');
      }
      return new PolygonUSDCAdapter({ rpcUrl, privateKey });
    }

    case 'mpesa-kenya':
      return new MPesaMockAdapter();

    case 'gcash-ph':
      return new GCashMockAdapter();

    case 'rwa-treasury':
      return new RWAMockAdapter();

    default:
      throw new Error(`Unknown network: ${networkId}`);
  }
}
