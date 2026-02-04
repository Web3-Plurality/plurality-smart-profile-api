import { ethers } from 'ethers';
import Logger from '../../lib/logger';

/**
 * ABI for PrivateProfileStorage contract
 */
const PRIVATE_STORAGE_ABI = [
  'function storePrivateData(address user, bytes calldata data) external',
  'function getPrivateData(address user) external view returns (bytes memory)',
  'function deletePrivateData(address user) external',
  'function hasPrivateData(address user) external view returns (bool)',
];

/**
 * Gas limits for Sapphire transactions.
 * ethers auto-estimation is unreliable on Sapphire because:
 * - Each 32-byte storage slot costs ~20k gas for SSTORE
 * - Overwriting existing bytes data clears old slots + writes new ones
 * - Sapphire TEE adds overhead beyond standard EVM costs
 * Unused gas is refunded, so generous limits are safe.
 */
const STORE_GAS_LIMIT = 15_000_000;
const DELETE_GAS_LIMIT = 5_000_000;

/**
 * Result from store/delete operations
 */
export interface StorageResult {
  txHash: string;
  gasUsed: bigint;
}

/**
 * Service for storing private data in Sapphire confidential contract
 * Data is automatically encrypted at rest by Sapphire TEE
 *
 * Note: The same backend wallet is used by PluralityAttestation and
 * PrepaidCreditService. To avoid nonce conflicts on slow networks,
 * this service waits for pending transactions to be mined before sending.
 */
export class SapphirePrivateStorage {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;
  private contractAddress: string;
  private initialized = false;

  constructor() {
    this.contractAddress = process.env.SAPPHIRE_PRIVATE_STORAGE_ADDRESS || '';

    if (!this.contractAddress) {
      Logger.warn('SAPPHIRE_PRIVATE_STORAGE_ADDRESS not set - private storage disabled');
    }
  }

  /**
   * Initialize the provider and contract
   * Note: We don't use Sapphire wrapper because:
   * 1. The contract is deployed on Sapphire - data is encrypted at rest by TEE
   * 2. View functions no longer have onlyBackend modifier
   * 3. The wrapper was causing empty calldata issues with ethers v6
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const rpcUrl = process.env.SAPPHIRE_RPC || 'https://testnet.sapphire.oasis.io';
    const privateKey = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';

    // Create provider and wallet directly (no Sapphire wrapper needed)
    const baseProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, baseProvider);
    this.provider = baseProvider;

    this.contract = new ethers.Contract(
      this.contractAddress,
      PRIVATE_STORAGE_ABI,
      this.signer
    );

    this.initialized = true;
    Logger.info(`Sapphire private storage initialized - backend address: ${this.signer.address}`);
  }

  /**
   * Wait until all pending transactions from this wallet are mined.
   * Prevents nonce conflicts when other services (PluralityAttestation,
   * PrepaidCreditService) have recently sent transactions from the same wallet.
   */
  private async waitForPendingTransactions(
    maxWaitMs = 120_000,
    pollIntervalMs = 3_000
  ): Promise<void> {
    if (!this.provider || !this.signer) return;

    const address = await this.signer.getAddress();
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const latestNonce = await this.provider.getTransactionCount(address, 'latest');
      const pendingNonce = await this.provider.getTransactionCount(address, 'pending');

      if (pendingNonce <= latestNonce) {
        Logger.info(
          `No pending txs for ${address} (nonce: ${latestNonce})`
        );
        return;
      }

      Logger.info(
        `Waiting for ${pendingNonce - latestNonce} pending tx(s) to be mined ` +
        `for ${address} (latest: ${latestNonce}, pending: ${pendingNonce})`
      );

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    Logger.warn(
      `Timed out waiting for pending txs after ${maxWaitMs}ms. Proceeding with 'pending' nonce.`
    );
  }

  /**
   * Send a contract transaction with explicit nonce management.
   * Waits for pending txs from other services, then uses explicit nonce.
   * Retries once on nonce conflict.
   */
  private async sendWithNonceManagement(
    contractCall: (nonce: number) => Promise<ethers.ContractTransactionResponse>,
    operationName: string
  ): Promise<ethers.ContractTransactionReceipt> {
    await this.waitForPendingTransactions();

    const address = await this.signer!.getAddress();
    const nonce = await this.provider!.getTransactionCount(address, 'pending');
    Logger.info(`${operationName}: using nonce ${nonce} for ${address}`);

    try {
      const tx = await contractCall(nonce);
      Logger.info(`${operationName}: tx submitted, hash=${tx.hash}, waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new Error(`${operationName}: transaction reverted (status=0)`);
      }

      return receipt;
    } catch (error: any) {
      const errorMsg = (error.message || '').toLowerCase();
      const isNonceError =
        errorMsg.includes('nonce') ||
        errorMsg.includes('replacement transaction underpriced') ||
        errorMsg.includes('already known');

      if (isNonceError) {
        Logger.warn(`${operationName}: nonce conflict, waiting and retrying...`);

        await this.waitForPendingTransactions();

        const retryNonce = await this.provider!.getTransactionCount(address, 'pending');
        Logger.info(`${operationName}: retrying with nonce ${retryNonce}`);

        const tx = await contractCall(retryNonce);
        Logger.info(`${operationName}: retry tx submitted, hash=${tx.hash}`);
        const receipt = await tx.wait();

        if (!receipt || receipt.status === 0) {
          throw new Error(`${operationName}: transaction reverted on retry (status=0)`);
        }

        return receipt;
      }

      throw error;
    }
  }

  /**
   * Check if the private storage system is enabled
   */
  isEnabled(): boolean {
    return !!this.contractAddress;
  }

  /**
   * Store private data for a user
   * @param userAddress - User's wallet address
   * @param privateData - Object containing private data
   * @returns Transaction hash and gas used
   */
  async store(userAddress: string, privateData: object): Promise<StorageResult> {
    if (!this.isEnabled()) {
      throw new Error('Sapphire private storage not configured');
    }

    await this.initialize();

    try {
      const dataBytes = ethers.toUtf8Bytes(JSON.stringify(privateData));

      const receipt = await this.sendWithNonceManagement(
        (nonce) => this.contract!.storePrivateData(userAddress, dataBytes, { nonce, gasLimit: STORE_GAS_LIMIT }),
        'storePrivateData'
      );

      const gasUsed = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || 0);

      Logger.info(
        `Private data stored for ${userAddress}: txHash=${receipt.hash}, gasUsed=${gasUsed}`
      );

      return {
        txHash: receipt.hash,
        gasUsed,
      };
    } catch (error: any) {
      Logger.error(`Failed to store private data for ${userAddress}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve private data for a user (FREE - no gas)
   * @param userAddress - User's wallet address
   * @returns Parsed private data object or null if not found
   */
  async retrieve(userAddress: string): Promise<object | null> {
    if (!this.isEnabled()) {
      Logger.warn('Sapphire private storage not configured, returning null');
      return null;
    }

    await this.initialize();

    try {
      const dataBytes = await this.contract!.getPrivateData(userAddress);

      if (!dataBytes || dataBytes === '0x' || dataBytes.length === 0) {
        return null;
      }

      const dataString = ethers.toUtf8String(dataBytes);
      return JSON.parse(dataString);
    } catch (error: any) {
      Logger.error(`Failed to retrieve private data for ${userAddress}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete private data for a user
   * @param userAddress - User's wallet address
   * @returns Transaction hash and gas used
   */
  async delete(userAddress: string): Promise<StorageResult> {
    if (!this.isEnabled()) {
      throw new Error('Sapphire private storage not configured');
    }

    await this.initialize();

    try {
      const receipt = await this.sendWithNonceManagement(
        (nonce) => this.contract!.deletePrivateData(userAddress, { nonce, gasLimit: DELETE_GAS_LIMIT }),
        'deletePrivateData'
      );

      const gasUsed = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || 0);

      Logger.info(
        `Private data deleted for ${userAddress}: txHash=${receipt.hash}, gasUsed=${gasUsed}`
      );

      return {
        txHash: receipt.hash,
        gasUsed,
      };
    } catch (error: any) {
      Logger.error(`Failed to delete private data for ${userAddress}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user has private data stored
   * @param userAddress - User's wallet address
   * @returns True if user has data stored
   */
  async hasData(userAddress: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    await this.initialize();

    try {
      return await this.contract!.hasPrivateData(userAddress);
    } catch (error: any) {
      Logger.error(`Failed to check private data for ${userAddress}: ${error.message}`);
      return false;
    }
  }

  /**
   * Estimate gas cost for store operation
   * @returns Estimated gas cost in wei
   */
  async estimateStoreGas(): Promise<bigint> {
    await this.initialize();

    try {
      // Store operations use significant gas on Sapphire:
      // - Each 32-byte slot: ~20k gas for SSTORE
      // - Typical private data (3-4 KB): ~3M gas units
      // - Overwriting existing data adds slot clearing overhead
      const gasUnits = BigInt(3_000_000);

      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000); // 100 gwei default

      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate store gas: ${error.message}`);
      // Fallback: ~0.3 ROSE
      return ethers.parseEther('0.3');
    }
  }

  /**
   * Estimate gas cost for delete operation
   * @returns Estimated gas cost in wei
   */
  async estimateDeleteGas(): Promise<bigint> {
    await this.initialize();

    try {
      // Delete clears all storage slots for user's data
      // Less expensive than store but still significant
      const gasUnits = BigInt(1_000_000);

      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000);

      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate delete gas: ${error.message}`);
      return ethers.parseEther('0.1');
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }
}

// Singleton instance
let sapphirePrivateStorageInstance: SapphirePrivateStorage | null = null;

/**
 * Get singleton instance of SapphirePrivateStorage
 */
export function getSapphirePrivateStorage(): SapphirePrivateStorage {
  if (!sapphirePrivateStorageInstance) {
    sapphirePrivateStorageInstance = new SapphirePrivateStorage();
  }
  return sapphirePrivateStorageInstance;
}
