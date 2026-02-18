import { ethers } from 'ethers';
import Logger from '../../lib/logger';

/**
 * ABI for PrivateProfileStorage contract (with SiweAuth)
 * - login() is inherited from SiweAuth, returns a bearer token valid for 24h
 * - getPrivateData() now takes a token param instead of relying on msg.sender
 */
const PRIVATE_STORAGE_ABI = [
  'function login(string message, tuple(bytes32 r, bytes32 s, uint256 v) sig) view returns (bytes)',
  'function getPrivateData(address user, bytes token) external view returns (bytes memory)',
  'function storePrivateData(address user, bytes calldata data) external',
  'function deletePrivateData(address user) external',
  'function hasPrivateData(address user) external view returns (bool)',
  'function domain() view returns (string)',
];

/**
 * Gas limits for Sapphire transactions.
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
 * Data is automatically encrypted at rest by Sapphire TEE.
 *
 * Authentication uses SIWE (Sign-In with Ethereum):
 * - Backend signs a SIWE message once → calls login() → gets bearer token valid 24h
 * - Token is passed to getPrivateData() for authenticated reads
 * - Token is cached in memory and refreshed automatically before expiry
 *
 * Note: The same backend wallet is used by PluralityAttestation and
 * PrepaidCreditService. To avoid nonce conflicts on slow networks,
 * this service waits for pending transactions to be mined before sending.
 */
export class SapphirePrivateStorage {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private wrappedContract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;
  private contractAddress: string;
  private initialized = false;

  // SIWE token cache (valid for 24h, refresh at 23h)
  private siweToken: string | null = null;
  private siweTokenExpiry = 0;
  private readonly TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

  constructor() {
    this.contractAddress = process.env.SAPPHIRE_PRIVATE_STORAGE_ADDRESS || '';

    if (!this.contractAddress) {
      Logger.warn('SAPPHIRE_PRIVATE_STORAGE_ADDRESS not set - private storage disabled');
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const rpcUrl = process.env.SAPPHIRE_RPC || 'https://testnet.sapphire.oasis.io';
    const privateKey = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';

    const baseProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, baseProvider);
    this.provider = baseProvider;

    // Plain signer for writes (store/delete transactions)
    this.contract = new ethers.Contract(
      this.contractAddress,
      PRIVATE_STORAGE_ABI,
      this.signer
    );

    // Wrapped signer for reads (Sapphire encryption for confidentiality)
    const { wrapEthersSigner } = await import('@oasisprotocol/sapphire-ethers-v6');
    const wrappedSigner = wrapEthersSigner(this.signer as any);
    this.wrappedContract = new ethers.Contract(
      this.contractAddress,
      PRIVATE_STORAGE_ABI,
      wrappedSigner as any
    );

    this.initialized = true;
    Logger.info(`Sapphire private storage initialized - backend address: ${this.signer.address}`);
  }

  /**
   * Get a valid SIWE bearer token, using cache if still fresh.
   * Token is valid for 24h on-chain; we refresh at 23h to be safe.
   */
  private async getSiweToken(): Promise<string> {
    const now = Date.now();
    if (this.siweToken && now < this.siweTokenExpiry) {
      return this.siweToken;
    }

    Logger.info('Obtaining new SIWE bearer token...');

    const { SiweMessage } = await import('siwe');

    const backendAddress = this.signer!.address;
    const { chainId } = await this.provider!.getNetwork();
    const siweD = process.env.SAPPHIRE_SIWE_DOMAIN || 'app.plurality.local';

    // Build SIWE message
    const siweMsg = new SiweMessage({
      domain: siweD,
      address: backendAddress,
      uri: siweD.includes(':') ? siweD : `http://${siweD}`,
      version: '1',
      chainId: Number(chainId),
    }).toMessage();

    // Sign the SIWE message
    const sig = ethers.Signature.from(await this.signer!.signMessage(siweMsg));

    // Call login() on-chain (free view call via wrapped contract)
    const token = await this.wrappedContract!.login(
      siweMsg,
      { r: sig.r, s: sig.s, v: sig.v }
    );

    this.siweToken = token;
    this.siweTokenExpiry = now + this.TOKEN_TTL_MS;

    Logger.info('SIWE bearer token obtained, valid for 23h');
    return token;
  }

  /**
   * Wait until all pending transactions from this wallet are mined.
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
        Logger.info(`No pending txs for ${address} (nonce: ${latestNonce})`);
        return;
      }

      Logger.info(
        `Waiting for ${pendingNonce - latestNonce} pending tx(s) to be mined ` +
        `for ${address} (latest: ${latestNonce}, pending: ${pendingNonce})`
      );

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    Logger.warn(`Timed out waiting for pending txs after ${maxWaitMs}ms. Proceeding with 'pending' nonce.`);
  }

  /**
   * Send a contract transaction with explicit nonce management.
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

  isEnabled(): boolean {
    return !!this.contractAddress;
  }

  /**
   * Store private data for a user
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
      Logger.info(`Private data stored for ${userAddress}: txHash=${receipt.hash}, gasUsed=${gasUsed}`);

      return { txHash: receipt.hash, gasUsed };
    } catch (error: any) {
      Logger.error(`Failed to store private data for ${userAddress}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve private data for a user (FREE - SIWE authenticated view call)
   * Uses a cached SIWE bearer token (refreshed every 23h) to authenticate.
   */
  async retrieve(userAddress: string): Promise<object | null> {
    if (!this.isEnabled()) {
      Logger.warn('Sapphire private storage not configured, returning null');
      return null;
    }

    await this.initialize();

    try {
      const token = await this.getSiweToken();
      const dataBytes = await this.wrappedContract!.getPrivateData(userAddress, token);

      if (!dataBytes || dataBytes === '0x' || dataBytes.length === 0) {
        return null;
      }

      const dataString = ethers.toUtf8String(dataBytes);
      return JSON.parse(dataString);
    } catch (error: any) {
      // If token expired or invalid, clear cache and retry once
      if (error.message?.includes('invalid token') || error.message?.includes('expired')) {
        Logger.warn('SIWE token may be expired, refreshing...');
        this.siweToken = null;
        this.siweTokenExpiry = 0;

        try {
          const token = await this.getSiweToken();
          const dataBytes = await this.wrappedContract!.getPrivateData(userAddress, token);

          if (!dataBytes || dataBytes === '0x' || dataBytes.length === 0) {
            return null;
          }

          const dataString = ethers.toUtf8String(dataBytes);
          return JSON.parse(dataString);
        } catch (retryError: any) {
          Logger.error(`Failed to retrieve after token refresh: ${retryError.message}`);
          return null;
        }
      }

      Logger.error(`Failed to retrieve private data for ${userAddress}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete private data for a user
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
      Logger.info(`Private data deleted for ${userAddress}: txHash=${receipt.hash}, gasUsed=${gasUsed}`);

      return { txHash: receipt.hash, gasUsed };
    } catch (error: any) {
      Logger.error(`Failed to delete private data for ${userAddress}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user has private data stored
   */
  async hasData(userAddress: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    await this.initialize();

    try {
      return await this.contract!.hasPrivateData(userAddress);
    } catch (error: any) {
      Logger.error(`Failed to check private data for ${userAddress}: ${error.message}`);
      return false;
    }
  }

  async estimateStoreGas(): Promise<bigint> {
    await this.initialize();
    try {
      const gasUnits = BigInt(3_000_000);
      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000);
      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate store gas: ${error.message}`);
      return ethers.parseEther('0.3');
    }
  }

  async estimateDeleteGas(): Promise<bigint> {
    await this.initialize();
    try {
      const gasUnits = BigInt(1_000_000);
      const feeData = await this.provider!.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000);
      return gasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Failed to estimate delete gas: ${error.message}`);
      return ethers.parseEther('0.1');
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }
}

// Singleton instance
let sapphirePrivateStorageInstance: SapphirePrivateStorage | null = null;

export function getSapphirePrivateStorage(): SapphirePrivateStorage {
  if (!sapphirePrivateStorageInstance) {
    sapphirePrivateStorageInstance = new SapphirePrivateStorage();
  }
  return sapphirePrivateStorageInstance;
}
