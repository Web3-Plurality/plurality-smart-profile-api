import { ethers } from 'ethers';
import Logger from '../../../lib/logger';

/**
 * ABI for PrepaidAttestationCredit contract (essential functions only)
 */
const PREPAID_CREDIT_ABI = [
  // Read functions
  'function credits(bytes32) view returns (uint256)',
  'function getBalance(bytes32 clientId) view returns (uint256)',
  'function checkSufficientCredits(bytes32 clientId, uint256 estimatedGasCost) view returns (bool hasSufficient, uint256 totalCost)',
  'function marginBasisPoints() view returns (uint256)',
  'function calculateTotalCost(uint256 gasCost) view returns (uint256)',
  'function minDeposit() view returns (uint256)',
  'function platformFeesCollected() view returns (uint256)',
  // Write functions (only callable by attestation service)
  'function deductCredits(bytes32 clientId, uint256 gasCost, bytes32 attestationUID)',
  'function deductCreditsForPair(bytes32 clientId, uint256 totalGasCost, bytes32 publicAttestationUID, bytes32 privateAttestationUID)',
];

/**
 * Result from checking client credits
 */
export interface CreditCheckResult {
  hasSufficient: boolean;
  totalCost: bigint;
  clientIdBytes32: string;
}

/**
 * Result from deducting credits
 */
export interface DeductionResult {
  success: boolean;
  txHash: string;
  gasCost: bigint;
  platformFee: bigint;
  totalDeducted: bigint;
}

/**
 * Service for interacting with PrepaidAttestationCredit smart contract
 */
export class PrepaidAttestationCreditService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer: ethers.Wallet;
  private contractAddress: string;

  constructor() {
    const rpcUrl = process.env.SAPPHIRE_RPC || 'https://testnet.sapphire.oasis.io';
    const privateKey = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    this.contractAddress = process.env.PREPAID_CREDIT_CONTRACT_ADDRESS || '';

    if (!this.contractAddress) {
      Logger.warn('PREPAID_CREDIT_CONTRACT_ADDRESS not set - credit system disabled');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      this.contractAddress,
      PREPAID_CREDIT_ABI,
      this.signer
    );
  }

  /**
   * Check if the credit system is enabled
   */
  isEnabled(): boolean {
    return !!this.contractAddress;
  }

  /**
   * Convert client app UUID to bytes32 for on-chain operations
   */
  clientIdToBytes32(clientAppId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(clientAppId));
  }

  /**
   * Get credit balance by clientAppId
   * Returns 0 on error (balance check is non-blocking)
   */
  async getBalance(clientAppId: string): Promise<bigint> {
    try {
      const clientIdBytes32 = this.clientIdToBytes32(clientAppId);
      return await this.contract.getBalance(clientIdBytes32);
    } catch (error: any) {
      Logger.warn(`Error getting balance for client ${clientAppId}: ${error.message}`);
      return BigInt(0);
    }
  }

  /**
   * Check if client has sufficient credits for an attestation
   * NOTE: On error, returns hasSufficient: false to block attestation
   */
  async checkSufficientCredits(
    clientAppId: string,
    estimatedGasCost: bigint
  ): Promise<CreditCheckResult> {
    try {
      const clientIdBytes32 = this.clientIdToBytes32(clientAppId);

      const [hasSufficient, totalCost] = await this.contract.checkSufficientCredits(
        clientIdBytes32,
        estimatedGasCost
      );

      return {
        hasSufficient,
        totalCost,
        clientIdBytes32,
      };
    } catch (error: any) {
      Logger.error(`Error checking credits for client ${clientAppId}: ${error.message}`);
      return {
        hasSufficient: false,
        totalCost: BigInt(0),
        clientIdBytes32: this.clientIdToBytes32(clientAppId),
      };
    }
  }

  /**
   * Deduct credits for a single attestation
   */
  async deductCredits(
    clientAppId: string,
    gasCost: bigint,
    attestationUID: string
  ): Promise<DeductionResult> {
    try {
      const clientIdBytes32 = this.clientIdToBytes32(clientAppId);
      const tx = await this.contract.deductCredits(
        clientIdBytes32,
        gasCost,
        attestationUID
      );
      const receipt = await tx.wait();

      const marginBp = BigInt(await this.getMarginBasisPoints());
      const platformFee = (gasCost * marginBp) / BigInt(10000);

      Logger.info(`Credits deducted - txHash: ${receipt.hash}, gasCost: ${gasCost}, fee: ${platformFee}`);

      return {
        success: true,
        txHash: receipt.hash,
        gasCost,
        platformFee,
        totalDeducted: gasCost + platformFee,
      };
    } catch (error: any) {
      Logger.error(`Error deducting credits: ${error.message}`);
      return {
        success: false,
        txHash: '',
        gasCost,
        platformFee: BigInt(0),
        totalDeducted: BigInt(0),
      };
    }
  }

  /**
   * Deduct credits for a pair of attestations (public + private)
   * This is the primary method used after attestSmartProfileOnChain
   * Total cost = (attestation gas + estimated deduction tx gas) × 1.10
   *
   * The contract will:
   * 1. Deduct totalGasCost + 10% from client's balance
   * 2. Transfer totalGasCost back to attester wallet (reimburse gas spent)
   * 3. Keep 10% as platform fee
   */
  async deductCreditsForPair(
    clientAppId: string,
    attestationGasCost: bigint,
    publicAttestationUID: string,
    privateAttestationUID: string
  ): Promise<DeductionResult> {
    try {
      // Estimate deduction tx gas cost upfront (~80k gas units typical)
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000); // 100 gwei default
      const estimatedDeductionGas = BigInt(100000) * gasPrice; // ~100k gas units with buffer

      // Total gas = attestation gas + estimated deduction tx gas
      const totalGasCost = attestationGasCost + estimatedDeductionGas;

      const clientIdBytes32 = this.clientIdToBytes32(clientAppId);
      const tx = await this.contract.deductCreditsForPair(
        clientIdBytes32,
        totalGasCost,
        publicAttestationUID,
        privateAttestationUID
      );
      const receipt = await tx.wait();

      const marginBp = BigInt(await this.getMarginBasisPoints());
      const platformFee = (totalGasCost * marginBp) / BigInt(10000);

      Logger.info(`Credits deducted - txHash: ${receipt.hash}, attestationGas: ${attestationGasCost}, estimatedDeductionGas: ${estimatedDeductionGas}, totalGas: ${totalGasCost}, fee: ${platformFee}`);

      return {
        success: true,
        txHash: receipt.hash,
        gasCost: totalGasCost,
        platformFee,
        totalDeducted: totalGasCost + platformFee,
      };
    } catch (error: any) {
      Logger.error(`Error deducting credits for pair: ${error.message}`);
      return {
        success: false,
        txHash: '',
        gasCost: attestationGasCost,
        platformFee: BigInt(0),
        totalDeducted: BigInt(0),
      };
    }
  }

  /**
   * Get margin basis points from contract
   */
  async getMarginBasisPoints(): Promise<number> {
    try {
      const margin = await this.contract.marginBasisPoints();
      return Number(margin);
    } catch (error: any) {
      Logger.error(`Error getting margin: ${error.message}`);
      return 1000; // Default 10%
    }
  }

  /**
   * Estimate total gas cost for attestation + deduction
   * Includes: public attestation + private attestation + deduction tx
   */
  async estimateAttestationGas(): Promise<bigint> {
    try {
      // Gas units breakdown:
      // - Public attestation: ~140k
      // - Private attestation: ~140k
      // - Deduction tx: ~100k (with buffer)
      const totalGasUnits = BigInt(380000);

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000); // 100 gwei default

      return totalGasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Error estimating gas: ${error.message}`);
      // Fallback: ~0.19 ROSE (280k + 100k @ 100 gwei)
      return ethers.parseEther('0.19');
    }
  }

  /**
   * Estimate total gas cost for full operation including Sapphire private storage
   * Includes: public attestation + private attestation + private data storage + deduction tx
   */
  async estimateFullOperationGas(): Promise<bigint> {
    try {
      // Gas units breakdown:
      // - Public attestation: ~140k
      // - Private attestation: ~140k
      // - Private data storage (Sapphire): ~80k
      // - Deduction tx: ~100k (with buffer)
      const totalGasUnits = BigInt(460000);

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000000); // 100 gwei default

      return totalGasUnits * gasPrice;
    } catch (error: any) {
      Logger.error(`Error estimating full operation gas: ${error.message}`);
      // Fallback: ~0.25 ROSE
      return ethers.parseEther('0.25');
    }
  }

  /**
   * Get minimum deposit amount
   */
  async getMinDeposit(): Promise<bigint> {
    try {
      return await this.contract.minDeposit();
    } catch (error: any) {
      Logger.error(`Error getting min deposit: ${error.message}`);
      return ethers.parseEther('0.1');
    }
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Get total platform fees collected
   */
  async getPlatformFeesCollected(): Promise<bigint> {
    try {
      return await this.contract.platformFeesCollected();
    } catch (error: any) {
      Logger.error(`Error getting platform fees: ${error.message}`);
      return BigInt(0);
    }
  }
}

// Singleton instance
let prepaidCreditServiceInstance: PrepaidAttestationCreditService | null = null;

/**
 * Get singleton instance of PrepaidAttestationCreditService
 */
export function getPrepaidCreditService(): PrepaidAttestationCreditService {
  if (!prepaidCreditServiceInstance) {
    prepaidCreditServiceInstance = new PrepaidAttestationCreditService();
  }
  return prepaidCreditServiceInstance;
}
