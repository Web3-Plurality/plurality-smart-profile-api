import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { CreditTransaction, TransactionType } from '../entity/client-credit';
import { isClientAppAuthenticated } from '../middlewares/auth-middleware';
import { getPrepaidCreditService } from '../utils/prepaid-credit-service';
import { ethers } from 'ethers';

export const creditRouter = express.Router();

const creditTransactionRepository = AppDataSource.getRepository(CreditTransaction);

/**
 * GET /crm/credits/balance
 * Get credit balance for authenticated client app
 */
creditRouter.get('/balance', isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Credits']
  /* #swagger.security = [{ "clientAppAuth": [] }] */
  try {
    const clientAppId = (req as any).clientApp?.id;

    if (!clientAppId) {
      return res.status(401).json({ success: false, error: 'Client app not authenticated' });
    }

    const creditService = getPrepaidCreditService();

    if (!creditService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Credit system not configured',
      });
    }

    // Get balance directly from on-chain
    const onChainBalance = await creditService.getBalance(clientAppId);

    return res.status(200).json({
      success: true,
      data: {
        creditBalanceWei: onChainBalance.toString(),
        creditBalanceROSE: ethers.formatEther(onChainBalance),
        clientIdBytes32: creditService.clientIdToBytes32(clientAppId),
      },
    });
  } catch (error: any) {
    Logger.error(`Error fetching credit balance: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

/**
 * GET /crm/credits/transactions
 * Get transaction history for a client app
 */
creditRouter.get('/transactions', isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Credits']
  /* #swagger.security = [{ "clientAppAuth": [] }] */
  try {
    const clientAppId = (req as any).clientApp?.id;

    if (!clientAppId) {
      return res.status(401).json({ success: false, error: 'Client app not authenticated' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const type = req.query.type as string;

    const whereCondition: any = { clientAppId: clientAppId };
    if (type && Object.values(TransactionType).includes(type as TransactionType)) {
      whereCondition.type = type;
    }

    const [transactions, total] = await creditTransactionRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    // Format transactions for response
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountWei: tx.amountWei,
      amountROSE: ethers.formatEther(tx.amountWei || '0'),
      gasCostWei: tx.gasCostWei,
      gasCostROSE: tx.gasCostWei ? ethers.formatEther(tx.gasCostWei) : null,
      platformFeeWei: tx.platformFeeWei,
      platformFeeROSE: tx.platformFeeWei ? ethers.formatEther(tx.platformFeeWei) : null,
      txHash: tx.txHash,
      attestationUID: tx.attestationUID,
      privateAttestationUID: tx.privateAttestationUID,
      userId: tx.userId,
      balanceAfterWei: tx.balanceAfterWei,
      balanceAfterROSE: tx.balanceAfterWei ? ethers.formatEther(tx.balanceAfterWei) : null,
      createdAt: tx.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    Logger.error(`Error fetching transactions: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /crm/credits/estimate
 * Get estimated cost for attestation operations
 */
creditRouter.get('/estimate', async (req: Request, res: Response) => {
  // #swagger.tags = ['Credits']
  try {
    const creditService = getPrepaidCreditService();

    if (!creditService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Credit system not configured',
      });
    }

    const estimatedGas = await creditService.estimateAttestationGas();
    const marginBasisPoints = await creditService.getMarginBasisPoints();
    const minDeposit = await creditService.getMinDeposit();

    const platformFee = (estimatedGas * BigInt(marginBasisPoints)) / BigInt(10000);
    const totalCost = estimatedGas + platformFee;

    return res.status(200).json({
      success: true,
      data: {
        estimatedGasWei: estimatedGas.toString(),
        estimatedGasROSE: ethers.formatEther(estimatedGas),
        platformFeeWei: platformFee.toString(),
        platformFeeROSE: ethers.formatEther(platformFee),
        marginBasisPoints: marginBasisPoints,
        marginPercentage: `${marginBasisPoints / 100}%`,
        totalCostWei: totalCost.toString(),
        totalCostROSE: ethers.formatEther(totalCost),
        minDepositWei: minDeposit.toString(),
        minDepositROSE: ethers.formatEther(minDeposit),
        description: 'Estimated cost for 1 profile attestation (public + private pair)',
      },
    });
  } catch (error: any) {
    Logger.error(`Error estimating costs: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to estimate costs' });
  }
});

/**
 * GET /crm/credits/contract-info
 * Get smart contract address and info for client integration
 */
creditRouter.get('/contract-info', isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Credits']
  /* #swagger.security = [{ "clientAppAuth": [] }] */
  try {
    const clientAppId = (req as any).clientApp?.id;
    const creditService = getPrepaidCreditService();

    if (!creditService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Credit system not configured. PREPAID_CREDIT_CONTRACT_ADDRESS not set.',
      });
    }

    const minDeposit = await creditService.getMinDeposit();
    const clientIdBytes32 = clientAppId ? creditService.clientIdToBytes32(clientAppId) : null;

    return res.status(200).json({
      success: true,
      data: {
        contractAddress: creditService.getContractAddress(),
        clientIdBytes32: clientIdBytes32,
        network: {
          name: 'Oasis Sapphire Testnet',
          chainId: 23295,
          rpcUrl: process.env.SAPPHIRE_RPC || 'https://testnet.sapphire.oasis.io',
          explorer: 'https://testnet.explorer.sapphire.oasis.io',
        },
        minDepositWei: minDeposit.toString(),
        minDepositROSE: ethers.formatEther(minDeposit),
        functions: {
          deposit: {
            signature: 'deposit(bytes32 clientId) payable',
            description: 'Deposit ROSE to get credits for a clientId (1 credit = 1 wei)',
          },
          getBalance: {
            signature: 'getBalance(bytes32 clientId) view returns (uint256)',
            description: 'Check credit balance for a clientId',
          },
          checkSufficientCredits: {
            signature: 'checkSufficientCredits(bytes32 clientId, uint256 estimatedGasCost) view returns (bool, uint256)',
            description: 'Check if clientId has enough credits for estimated gas cost',
          },
        },
        workflow: [
          '1. Get your clientIdBytes32 from this endpoint',
          '2. Call deposit(clientIdBytes32) with ROSE value to add credits',
          '3. Make attestation API calls - credits are auto-deducted',
          '4. Admin can withdraw unused credits via withdrawCreditsTo()',
        ],
      },
    });
  } catch (error: any) {
    Logger.error(`Error fetching contract info: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch contract info' });
  }
});

/**
 * GET /crm/credits/check
 * Quick check if client has sufficient credits for an attestation
 */
creditRouter.get('/check', isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Credits']
  /* #swagger.security = [{ "clientAppAuth": [] }] */
  try {
    const clientAppId = (req as any).clientApp?.id;

    if (!clientAppId) {
      return res.status(401).json({ success: false, error: 'Client app not authenticated' });
    }

    const creditService = getPrepaidCreditService();

    if (!creditService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Credit system not configured',
      });
    }

    const estimatedGas = await creditService.estimateAttestationGas();
    const result = await creditService.checkSufficientCredits(clientAppId, estimatedGas);

    return res.status(200).json({
      success: true,
      data: {
        hasSufficientCredits: result.hasSufficient,
        estimatedCostWei: result.totalCost.toString(),
        estimatedCostROSE: ethers.formatEther(result.totalCost),
        clientIdBytes32: result.clientIdBytes32,
        action: result.hasSufficient
          ? 'Ready for attestation'
          : 'Deposit more ROSE to the contract using deposit(clientIdBytes32)',
      },
    });
  } catch (error: any) {
    Logger.error(`Error checking credits: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to check credits' });
  }
});
