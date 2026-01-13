import { ethers } from 'ethers';
import { NetworkConfig } from '@crossborder/core';
import {
  NetworkAdapter,
  QuoteRequest,
  NetworkQuote,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentConfirmationResult,
  NetworkPaymentStatus,
} from '../../interface';

// USDC on Polygon Amoy Testnet
const USDC_CONTRACT_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const USDC_DECIMALS = 6;

// Minimal ERC20 ABI for transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export class PolygonUSDCAdapter implements NetworkAdapter {
  readonly config: NetworkConfig = {
    id: 'polygon-amoy-usdc',
    type: 'stablecoin',
    displayName: 'USDC on Polygon (Testnet)',
    supportedCurrencies: [
      { source: 'USD', dest: 'USDC' },
    ],
    requiredFields: [
      { path: 'receiver.walletAddress', type: 'string', description: 'Recipient wallet address (0x...)' },
    ],
    limits: { min: 1, max: 10000 },
  };

  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private usdcContract: ethers.Contract;
  private pendingTxs: Map<string, { hash: string; status: string }> = new Map();

  // Required confirmations for finality
  private readonly REQUIRED_CONFIRMATIONS = 12;

  constructor(config: { rpcUrl: string; privateKey: string }) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, this.wallet);
  }

  async getQuote(request: QuoteRequest): Promise<NetworkQuote> {
    // USDC is 1:1 with USD, small gas fee
    const gasFee = 0.01; // Estimated gas in USD
    return {
      networkId: this.config.id,
      sourceAmount: request.sourceAmount,
      sourceCurrency: 'USD',
      destAmount: request.sourceAmount - gasFee,
      destCurrency: 'USDC',
      fxRate: 1,
      fee: gasFee,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
      networkMetadata: {
        contractAddress: USDC_CONTRACT_ADDRESS,
        network: 'polygon-amoy',
      },
    };
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    const recipientAddress = request.receiver.walletAddress;
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      throw new Error('Invalid recipient wallet address');
    }

    // Convert amount to USDC units (6 decimals)
    const amount = ethers.parseUnits(request.destAmount.toString(), USDC_DECIMALS);

    try {
      // Send the transaction
      const tx = await this.usdcContract.transfer(recipientAddress, amount);

      // Store pending tx
      this.pendingTxs.set(tx.hash, { hash: tx.hash, status: 'SUBMITTED' });

      return {
        networkPaymentId: tx.hash,
        status: 'SUBMITTED',
        networkMetadata: {
          txHash: tx.hash,
          from: this.wallet.address,
          to: recipientAddress,
          amount: request.destAmount,
          network: 'polygon-amoy',
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        networkPaymentId: '',
        status: 'FAILED',
        networkMetadata: { error: errorMessage },
      };
    }
  }

  async confirmPayment(networkPaymentId: string): Promise<PaymentConfirmationResult> {
    const receipt = await this.provider.getTransactionReceipt(networkPaymentId);

    if (!receipt) {
      return {
        status: 'CONFIRMED', // Still pending in mempool
        confirmedAt: new Date().toISOString(),
        networkMetadata: { confirmations: 0 },
      };
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    if (receipt.status === 0) {
      return {
        status: 'FAILED',
        confirmedAt: new Date().toISOString(),
        networkMetadata: { confirmations, reverted: true },
        failureReason: 'Transaction reverted',
      };
    }

    return {
      status: confirmations >= this.REQUIRED_CONFIRMATIONS ? 'COMPLETED' : 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      networkMetadata: {
        confirmations,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
    };
  }

  async getPaymentStatus(networkPaymentId: string): Promise<NetworkPaymentStatus> {
    const receipt = await this.provider.getTransactionReceipt(networkPaymentId);

    if (!receipt) {
      return {
        networkPaymentId,
        status: 'SUBMITTED',
        updatedAt: new Date().toISOString(),
        networkMetadata: { confirmations: 0, pending: true },
      };
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    if (receipt.status === 0) {
      return {
        networkPaymentId,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
        networkMetadata: { confirmations, reverted: true },
        failureReason: 'Transaction reverted',
      };
    }

    return {
      networkPaymentId,
      status: confirmations >= this.REQUIRED_CONFIRMATIONS ? 'COMPLETED' : 'CONFIRMED',
      updatedAt: new Date().toISOString(),
      networkMetadata: {
        confirmations,
        requiredConfirmations: this.REQUIRED_CONFIRMATIONS,
        blockNumber: receipt.blockNumber,
      },
    };
  }
}
