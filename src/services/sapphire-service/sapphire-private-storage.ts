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
 * Result from store/delete operations
 */
export interface StorageResult {
  txHash: string;
  gasUsed: bigint;
}

/**
 * Service for storing private data in Sapphire confidential contract
 * Data is automatically encrypted at rest by Sapphire TEE
 */
export class SapphirePrivateStorage {
  private provider: any = null;
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

      const tx = await this.contract!.storePrivateData(userAddress, dataBytes);
      const receipt = await tx.wait();

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
      const tx = await this.contract!.deletePrivateData(userAddress);
      const receipt = await tx.wait();

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
      // Typical store operation: ~80k gas units
      const gasUnits = BigInt(80000);

      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000); // 100 gwei default

      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate store gas: ${error.message}`);
      // Fallback: ~0.008 ROSE
      return ethers.parseEther('0.008');
    }
  }

  /**
   * Estimate gas cost for delete operation
   * @returns Estimated gas cost in wei
   */
  async estimateDeleteGas(): Promise<bigint> {
    await this.initialize();

    try {
      // Typical delete operation: ~50k gas units
      const gasUnits = BigInt(50000);

      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000);

      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate delete gas: ${error.message}`);
      return ethers.parseEther('0.005');
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
