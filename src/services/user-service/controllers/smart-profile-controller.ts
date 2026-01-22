import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import { memoryStoreProfile } from '../../../utils/global';
import { calculateSocialScore } from '../utils/score';
import { plainToInstance } from 'class-transformer';
import { SmartProfileMap } from '../entity/smart-profile-map';
import { EarlyUser } from '../entity/early-user';
import { isAuthenticated, isValidAttestation } from '../middlewares/auth-middleware';
import { User } from '../entity/user';
import {
  normalizeSmartProfile,
  PluralityAttestation,
  SmartProfile,
  ScoreTypes,
} from '@plurality-network/smart-profile-utils';
import { createPrompt, USER_ONBOARDING_INSIGHTS_PROMPT } from '../../oauth-service/utils/ai-prompts';
import { analyze } from '../../oauth-service/utils/groq';
import { getPrepaidCreditService } from '../../crm-service/utils/prepaid-credit-service';
import { CreditTransaction, TransactionType } from '../../crm-service/entity/client-credit';
import { ethers } from 'ethers';
import { getSapphirePrivateStorage } from '../../sapphire-service/sapphire-private-storage';

export const smartProfileRouter = express.Router();
dotenv.config();
const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);
const earlyUserRepository = AppDataSource.getRepository(EarlyUser);
const userRepository = AppDataSource.getRepository(User);
const creditTransactionRepository = AppDataSource.getRepository(CreditTransaction);

// Initialize prepaid credit service
const prepaidCreditService = getPrepaidCreditService();

/**
 * Helper function to check credits before attestation
 * Returns hasSufficientCredits: true if ok, or an errorResponse if not
 */
async function checkCreditsBeforeAttestation(clientAppId: string): Promise<{
  hasSufficientCredits: boolean;
  estimatedCost: bigint;
  errorResponse?: {
    success: boolean;
    error: string;
    requiredCredits: string;
    requiredCreditsROSE: string;
    depositUrl: string;
  };
}> {
  // Skip credit check if credit system is not enabled
  if (!prepaidCreditService.isEnabled()) {
    return { hasSufficientCredits: true, estimatedCost: BigInt(0) };
  }

  const estimatedGas = await prepaidCreditService.estimateAttestationGas();
  const result = await prepaidCreditService.checkSufficientCredits(clientAppId, estimatedGas);

  if (!result.hasSufficient) {
    return {
      hasSufficientCredits: false,
      estimatedCost: result.totalCost,
      errorResponse: {
        success: false,
        error: 'Insufficient attestation credits',
        requiredCredits: result.totalCost.toString(),
        requiredCreditsROSE: ethers.formatEther(result.totalCost),
        depositUrl: '/crm/credits/contract-info',
      },
    };
  }

  return {
    hasSufficientCredits: true,
    estimatedCost: result.totalCost,
  };
}

/**
 * Helper function to deduct credits and log transaction after successful attestation
 */
async function deductCreditsAfterAttestation(
  clientAppId: string,
  attestationResult: {
    publicAttestationUID: string;
    privateAttestationUID: string;
    totalGasCost: bigint;
  },
  userId?: string
): Promise<void> {
  // Skip if credit system is not enabled
  if (!prepaidCreditService.isEnabled()) {
    return;
  }

  try {
    const deductionResult = await prepaidCreditService.deductCreditsForPair(
      clientAppId,
      attestationResult.totalGasCost,
      attestationResult.publicAttestationUID,
      attestationResult.privateAttestationUID
    );

    if (deductionResult.success) {
      // Log the transaction
      const transaction = creditTransactionRepository.create({
        clientAppId: clientAppId,
        type: TransactionType.DEDUCTION,
        amountWei: deductionResult.totalDeducted.toString(),
        gasCostWei: deductionResult.gasCost.toString(),
        platformFeeWei: deductionResult.platformFee.toString(),
        txHash: deductionResult.txHash,
        attestationUID: attestationResult.publicAttestationUID,
        privateAttestationUID: attestationResult.privateAttestationUID,
        userId: userId,
      });
      await creditTransactionRepository.save(transaction);
      Logger.info(`Credits deducted for attestation - clientApp: ${clientAppId}, amount: ${deductionResult.totalDeducted}`);
    } else {
      Logger.error(`Failed to deduct credits for clientApp: ${clientAppId}`);
    }
  } catch (error: any) {
    Logger.error(`Error deducting credits: ${error.message}`);
  }
}

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

// On-chain attestation instance (Oasis Sapphire)
const pluralityAttestation = new PluralityAttestation({
  signerPrivateKey: process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '',
  signerAddress: process.env.PUBLIC_DAPP_OWNER_WALLET_ADDRESS || '',
  easContractAddress: process.env.SAPPHIRE_EAS_ADDRESS || '',
  rpcProvider: process.env.SAPPHIRE_RPC || '',
});

smartProfileRouter.put(
  '/',
  isAuthenticated,
  isValidAttestation,
  [
    body('data.username').optional().trim().isLength({ max: 50 }),
    body('data.bio').optional().trim().isLength({ max: 3000 }),
    body('smartProfile').custom((value) => {
      if (Object.keys(value).length === 0) {
        throw new Error('smartProfile must not be empty');
      }
      // Ensure the object is an instance of SmartProfile
      if (!(plainToInstance(SmartProfile, JSON.parse(JSON.stringify(value))) instanceof SmartProfile)) {
        throw new Error('smartProfile must be an instance of SmartProfile');
      }
      return true;
    }),
    body('data.profileImg')
      .optional()
      .trim()
      .custom((value) => {
        // If the value is empty or undefined, allow it to pass
        if (!value) {
          return true;
        }
        const base64Pattern = /^data:image\/(jpeg|png|gif|bmp|tiff|webp);base64,/;
        const urlPattern = /^(https?:\/\/)/i;

        if (!base64Pattern.test(value) && !urlPattern.test(value)) {
          throw new Error('Profile image must be either a base64 encoded image or a valid URL');
        }
        return true;
      }),
  ],
  async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        Logger.error(`Fatal error due to improper request parameters to route GET /: ${JSON.stringify(errors)}`);
        return res.status(400).json({ errors: errors.array() });
      }
      // load this dynamically from headers
      // add a check if this profileTypeStreamId exists in client app table
      if (!req.headers['x-profile-type-stream-id'] || typeof req.headers['x-profile-type-stream-id'] !== 'string') {
        Logger.error(`Fatal error due to missing profile type stream id`);
        return res.status(400).json({ errors: 'profile type stream id is missing' });
      }
      if (!req.headers['x-client-app-id'] || typeof req.headers['x-client-app-id'] !== 'string') {
        Logger.error(`Fatal error due to missing client app id`);
        return res.status(400).json({ errors: 'client app id is missing' });
      }
      const clientAppId = req.headers['x-client-app-id'];
      const profileTypeStreamId = req.headers['x-profile-type-stream-id'];
      const userUpdateReqData = req.body.data ? JSON.parse(JSON.stringify(req.body.data)) : {};

      // Validate smartProfile is present in request body
      if (!req?.body?.smartProfile) {
        Logger.error(`smartProfile is missing from request body`);
        return res.status(400).json({ success: false, error: 'smartProfile is required in request body' });
      }
      const smartProfile = normalizeSmartProfile(req.body.smartProfile);
      const id = req?.user?.id;
      // get from smartProfileMap
      const existingUser = await smartProfileMapRepository.findOne({
        where: {
          userId: id,
          profileTypeStreamId: profileTypeStreamId,
        },
      });

      if (existingUser) {
        Logger.info(`This user exists in smartProfileMap! id: ${existingUser?.id}`);
        // Upload an image
        let uploadResult;
        if (userUpdateReqData.profileImg) {
          uploadResult = await cloudinary.uploader.upload(userUpdateReqData.profileImg).catch((error) => {
            console.log(error);
          });
        }
        // now update the original smart profile with the updated values and return
        if (smartProfile) {
          smartProfile.username = userUpdateReqData.username || smartProfile?.username;
          smartProfile.avatar = uploadResult?.secure_url || smartProfile?.avatar;
          smartProfile.bio = userUpdateReqData.bio || smartProfile?.bio;

          // if we have onboarding data but did not assign to smart profile then we assign it smart profile
          let onBoardingAvailable = false;
          if (
            clientAppId &&
            !smartProfile?.extendedPublicData?.[clientAppId]?.onboardingData &&
            userUpdateReqData?.onboardingData &&
            Object.keys(userUpdateReqData?.onboardingData || {})?.length > 0
          ) {
            smartProfile.extendedPublicData[clientAppId] = { onboardingData: userUpdateReqData.onboardingData };
            onBoardingAvailable = true;
          }

          // Only update onboarding data in database (profile data is in attestation)
          let updatedUser: any = {};

          if (onBoardingAvailable) {
            // check if the onboarding data for this client is already present in the userOnboardingMap
            const previousOnboardingData = Array.isArray(existingUser?.userOnboardingMap)
              ? existingUser.userOnboardingMap.find((item) => item.clientAppId === clientAppId)
              : undefined;
            // if onboarding data for this client is not present then we add it
            // this is the first time onboarding data is being added for this client
            if (!previousOnboardingData) {
              updatedUser = {
                ...updatedUser,
                userOnboardingMap: [
                  ...(Array.isArray(existingUser?.userOnboardingMap) ? existingUser?.userOnboardingMap : []),
                  {
                    clientAppId: clientAppId,
                    onboardingData: userUpdateReqData?.onboardingData,
                  },
                ],
              };
            }
            // if onboarding data is already present for this client then we overwrite it
            else {
              updatedUser = {
                ...updatedUser,
                userOnboardingMap: [
                  ...(Array.isArray(existingUser?.userOnboardingMap) ? existingUser?.userOnboardingMap : []).map(
                    (item) => {
                      if (item.clientAppId === clientAppId) {
                        return {
                          ...item,
                          onboardingData: userUpdateReqData?.onboardingData,
                        };
                      }
                      return item;
                    },
                  ),
                ],
              };
            }
          }
          // Check credits BEFORE any DB updates (prevent partial state on failure)
          const creditCheck = await checkCreditsBeforeAttestation(clientAppId);
          if (!creditCheck.hasSufficientCredits) {
            Logger.error(`Insufficient credits for profile update - client: ${clientAppId}`);
            return res.status(402).json(creditCheck.errorResponse);
          }

          // Update the existing profile (only if there's onboarding data to update)
          if (onBoardingAvailable && Object.keys(updatedUser).length > 0) {
            await smartProfileMapRepository.update(
              { id: existingUser.id, profileTypeStreamId: profileTypeStreamId },
              updatedUser,
            );
            Logger.info(`Smart profile onboarding data updated locally for user id: ${id}`);
          }
          // attest profile
          const user = await userRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });
          // get insights from user onboarding Questions
          if (onBoardingAvailable) {
            Logger.info(`Analyzing user onboarding insights`, userUpdateReqData?.onboardingData);
            const prompt = createPrompt(
              USER_ONBOARDING_INSIGHTS_PROMPT,
              JSON.stringify(userUpdateReqData?.onboardingData),
            );
            const insights = await analyze(prompt);
            insights?.interests?.length && smartProfile.privateData.claims.interests.push(...insights?.interests);
            insights?.collections?.length && smartProfile.privateData.claims.collections.push(...insights?.collections);
            insights?.badges?.length && smartProfile.privateData.claims.badges.push(...insights?.badges);
            insights?.reputationTags?.length &&
              smartProfile.privateData.claims.reputationTags.push(...insights?.reputationTags);
          }

          // Create on-chain attestation on Oasis Sapphire
          const attestationResult = await pluralityAttestation.attestSmartProfileOnChain(
            smartProfile,
            user?.metamaskAddress || '',
            process.env.SAPPHIRE_PUBLIC_SCHEMA_UID || '',
            process.env.SAPPHIRE_PRIVATE_SCHEMA_UID || '',
          );

          // Deduct credits after successful attestation
          await deductCreditsAfterAttestation(
            clientAppId,
            {
              publicAttestationUID: attestationResult.publicAttestationUID,
              privateAttestationUID: attestationResult.privateAttestationUID,
              totalGasCost: attestationResult.totalGasCost,
            },
            req?.user?.id
          );

          // Extract attestation UIDs and metadata from the on-chain attestation result
          const onchainUID = attestationResult.publicAttestationUID;
          const privateUID = attestationResult.privateAttestationUID;
          const txHash = attestationResult.transactionHashes[0];
          const chainId = attestationResult.chainId;

          Logger.info(`Created on-chain attestation - onchainUID: ${onchainUID}, txHash: ${txHash}`);

          // Save attestation UIDs to smart_profile_map
          // NOTE: Do NOT store privateData here - it's plain data from frontend
          // Encrypted privateData will be stored via /store-private-data endpoint
          const updateData: any = {
            onchainAttestationUID: onchainUID,
            privateAttestationUID: privateUID,
            attestationChain: 'sapphire',
            attestationTxHash: txHash,
            attestationTimestamp: Date.now(),
          };

          await smartProfileMapRepository.update(
            { id: existingUser.id, profileTypeStreamId: profileTypeStreamId },
            updateData,
          );
          Logger.info(`Attestation UIDs saved to smart_profile_map for user id: ${id}`);

          const responseProfile = JSON.parse(JSON.stringify(smartProfile));
          responseProfile.onchainAttestationUID = onchainUID;
          responseProfile.privateAttestationUID = privateUID;
          responseProfile.attestationTxHash = txHash;
          responseProfile.chainId = chainId;

          return res.status(200).json({
            success: true,
            smartProfile: responseProfile
          });
        } else {
          Logger.error(`user profile not found on body`);
          return res.status(400).json({ success: false, error: 'user profile not found in the body' });
        }
      } else {
        // User with this profile does not exist
        Logger.info(`This user with this profile does not exist!`);
        return res.status(404).json({ exists: false });
      }
    } catch (e: any) {
      Logger.error(`Fatal error in PUT /user/smart-profile: ${e?.message || JSON.stringify(e)}`);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  },
);

// body => { smartProfile: SmartProfile }
// header => { Authorization: Bearer token. x-profile-type-stream-id }
// isValidAttestation middleware checks if the attestation is valid
smartProfileRouter.post(
  '/',
  isAuthenticated,
  [
    body('smartProfile').custom((value) => {
      // Ensure the object is an instance of SmartProfile
      if (!(plainToInstance(SmartProfile, JSON.parse(JSON.stringify(value))) instanceof SmartProfile)) {
        throw new Error('smartProfile must be an instance of SmartProfile');
      }
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    try {
      // load dynamically from header
      // add a check if this profileTypeStreamId exists in client app table
      const { smartProfile: reqSmartProfile } = req.body;
      if (!req.headers['x-profile-type-stream-id'] || typeof req.headers['x-profile-type-stream-id'] !== 'string') {
        Logger.error(`Fatal error due to missing profile type stream id`);
        return res.status(400).json({ errors: 'profile type stream id is missing' });
      }
      if (!req.headers['x-client-app-id'] || typeof req.headers['x-client-app-id'] !== 'string') {
        Logger.error(`Fatal error due to missing client app id`);
        return res.status(400).json({ errors: 'client app id is missing' });
      }
      const clientAppId = req.headers['x-client-app-id'];
      const profileTypeStreamId = req.headers['x-profile-type-stream-id'];
      // probably we dont need these both
      const id = req?.user?.uniqueSessionId;
      const memorySmartProfile = memoryStoreProfile.get(id)?.smartProfile;

      // new profile creation
      if (!memorySmartProfile && Object.keys(reqSmartProfile).length === 0 && profileTypeStreamId) {
        Logger.info(`New profile creation workflow`);
        // check if the profile map between user id and profile type exists
        const profileMapping = await smartProfileMapRepository.findOne({
          where: {
            userId: req?.user?.id,
            profileTypeStreamId: profileTypeStreamId,
          },
        });
        if (!profileMapping) {
          // this is the new user
          const earlyUser = await earlyUserRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });
          const newProfile = new SmartProfile({
            username: earlyUser?.username ? earlyUser?.username : faker.person.lastName().toLocaleLowerCase(),
            avatar: earlyUser?.profileImg
              ? earlyUser?.profileImg
              : 'https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png',
            bio: '',
            profileTypeStreamId: profileTypeStreamId,
          });
          newProfile.updateScoreValue(
            ScoreTypes.socialScore,
            earlyUser?.username ? 1000 : Number(process.env.DEFAULT_SOCIAL_SCORE),
          );

          // Check credits BEFORE creating profile mapping (prevent orphaned profiles)
          const creditCheck = await checkCreditsBeforeAttestation(clientAppId);
          if (!creditCheck.hasSufficientCredits) {
            Logger.error(`Insufficient credits for profile creation - client: ${clientAppId}`);
            return res.status(402).json(creditCheck.errorResponse);
          }

          // Create profile mapping (only after credit check passes)
          const newSmartProfileMap = await smartProfileMapRepository.create({
            profileTypeStreamId: profileTypeStreamId,
            userId: req?.user?.id,
          });

          const savedProfileMap = await smartProfileMapRepository.save(newSmartProfileMap);
          Logger.info(`New smart profile created for user id: ${id} against clientAppId: ${clientAppId}`);

          // profile attestation
          const existingUser = await userRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });

          // Create on-chain attestation on Oasis Sapphire
          const attestationResult = await pluralityAttestation.attestSmartProfileOnChain(
            newProfile,
            existingUser?.metamaskAddress || '',
            process.env.SAPPHIRE_PUBLIC_SCHEMA_UID || '',
            process.env.SAPPHIRE_PRIVATE_SCHEMA_UID || '',
          );

          // Deduct credits after successful attestation
          await deductCreditsAfterAttestation(
            clientAppId,
            {
              publicAttestationUID: attestationResult.publicAttestationUID,
              privateAttestationUID: attestationResult.privateAttestationUID,
              totalGasCost: attestationResult.totalGasCost,
            },
            req?.user?.id
          );

          Logger.info(`On-chain attestation result: publicUID=${attestationResult.publicAttestationUID}, privateUID=${attestationResult.privateAttestationUID}, chainId=${attestationResult.chainId}, gasCost=${attestationResult.totalGasCost}`);

          // Save attestation UIDs to smart_profile_map
          // NOTE: Do NOT store privateData here - it's plain data from frontend
          // Encrypted privateData will be stored via /store-private-data endpoint
          const updateDataNew: any = {
            onchainAttestationUID: attestationResult.publicAttestationUID,
            privateAttestationUID: attestationResult.privateAttestationUID,
            attestationChain: 'sapphire',
            attestationTxHash: attestationResult.transactionHashes[0],
            attestationTimestamp: Date.now(),
          };

          await smartProfileMapRepository.update(
            { id: savedProfileMap.id },
            updateDataNew,
          );
          Logger.info(`Attestation UIDs saved for new profile - user id: ${id}`);

          const responseProfile = JSON.parse(JSON.stringify(newProfile));
          responseProfile.onchainAttestationUID = attestationResult.publicAttestationUID;
          responseProfile.privateAttestationUID = attestationResult.privateAttestationUID;
          responseProfile.attestationTxHash = attestationResult.transactionHashes[0];
          responseProfile.chainId = attestationResult.chainId;

          return res.status(200).json({
            success: true,
            smartProfile: responseProfile,
            message: `smart profile registered against cliantApp ID: ${clientAppId}`,
          });
        } else {
          // Profile map exists in database
          Logger.info(`Profile map already found for user: ${profileMapping.userId}`);

          // If attestation UIDs exist, profile already exists on blockchain
          if (profileMapping.onchainAttestationUID) {
            Logger.info(`Profile already exists on blockchain`);
            return res.status(409).json({
              success: false,
              error: 'Profile already exists. Please refresh the page or re-authenticate.',
              attestationUID: profileMapping.onchainAttestationUID,
            });
          }

          // No attestation UIDs or verification failed - create new attestation from legacy data
          Logger.info(`Creating new attestation for existing profile map (legacy migration)`);
          const oldProfile = new SmartProfile({
            username: profileMapping?.username ? profileMapping?.username : faker.person.lastName().toLocaleLowerCase(),
            avatar: profileMapping?.avatar
              ? profileMapping?.avatar
              : 'https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png',
            bio: profileMapping?.bio,
            profileTypeStreamId: profileTypeStreamId,
          });

          const earlyUser = await earlyUserRepository.findOne({
            where: { id: req?.user?.id },
          });

          oldProfile.updateScoreValue(
            ScoreTypes.socialScore,
            earlyUser?.username ? 1000 : Number(process.env.DEFAULT_SOCIAL_SCORE),
          );

          const existingUser = await userRepository.findOne({
            where: { id: req?.user?.id },
          });

          // Check credits before attestation
          const creditCheckLegacy = await checkCreditsBeforeAttestation(clientAppId);
          if (!creditCheckLegacy.hasSufficientCredits) {
            Logger.error(`Insufficient credits for legacy migration - client: ${clientAppId}`);
            return res.status(402).json(creditCheckLegacy.errorResponse);
          }

          // Create on-chain attestation on Oasis Sapphire
          const attestationResult = await pluralityAttestation.attestSmartProfileOnChain(
            oldProfile,
            existingUser?.metamaskAddress || '',
            process.env.SAPPHIRE_PUBLIC_SCHEMA_UID || '',
            process.env.SAPPHIRE_PRIVATE_SCHEMA_UID || '',
          );

          // Deduct credits after successful attestation
          await deductCreditsAfterAttestation(
            clientAppId,
            {
              publicAttestationUID: attestationResult.publicAttestationUID,
              privateAttestationUID: attestationResult.privateAttestationUID,
              totalGasCost: attestationResult.totalGasCost,
            },
            req?.user?.id
          );

          // Save attestation UIDs to smart_profile_map
          // NOTE: Do NOT store privateData here - it's plain data from frontend
          // Encrypted privateData will be stored via /store-private-data endpoint
          const updateDataLegacy: any = {
            onchainAttestationUID: attestationResult.publicAttestationUID,
            privateAttestationUID: attestationResult.privateAttestationUID,
            attestationChain: 'sapphire',
            attestationTxHash: attestationResult.transactionHashes[0],
            attestationTimestamp: Date.now(),
          };

          await smartProfileMapRepository.update(
            { userId: req?.user?.id, profileTypeStreamId },
            updateDataLegacy,
          );
          Logger.info(`Legacy profile migrated to on-chain - user id: ${id}`);

          const responseDataLegacy: any = {
            onchainAttestationUID: attestationResult.publicAttestationUID,
            privateAttestationUID: attestationResult.privateAttestationUID,
            attestationTxHash: attestationResult.transactionHashes[0],
            chainId: attestationResult.chainId,
          };

          return res.status(200).json({
            success: true,
            smartProfile: responseDataLegacy
          });
        }
        // } else if (!memorySmartProfile && Object.keys(reqSmartProfile).length > 0 && profileTypeStreamId) {
        //   // when smart profile is present in the request body against a client different client app id
        //   Logger.info(`Smart profile is present in the request body against a client different client app id`);
        //   const profileMapping = await smartProfileMapRepository.findOne({
        //     where: {
        //       userId: req?.user?.id,
        //       profileTypeStreamId: profileTypeStreamId,
        //       clientAppDev: {
        //         id: clientAppId,
        //       },
        //     },
        //   });
        //   if (!profileMapping) {
        //     const newSmartProfileMap = await smartProfileMapRepository.create({
        //       username: reqSmartProfile?.username,
        //       avatar: reqSmartProfile?.avatar,
        //       bio: reqSmartProfile?.bio,
        //       connectedProfiles: [],
        //       scores: reqSmartProfile?.scores,
        //       profileTypeStreamId: profileTypeStreamId,
        //       userId: req?.user?.id,
        //       clientAppDev: {
        //         id: clientAppId,
        //       },
        //     });

        //     await smartProfileMapRepository.save(newSmartProfileMap);
        //     Logger.info(`New smart profile created for user id: ${id} against clientAppId: ${clientAppId}`);
        //     return res.status(200).json({
        //       success: true,
        //       smartProfile: reqSmartProfile,
        //       message: `smart profile registered against cliantApp ID: ${clientAppId}`,
        //     });
        //   }
        //  else {
        //     Logger.error(`smart profile Map and smart profile already exist against cliantApp ID: ${clientAppId}`);
        //     // should we send 200 or 400?
        //     return res.status(400).json({ error: `smart profile already exists against cliantApp ID: ${clientAppId}` });
        //   }
      } else {
        Logger.error(
          `Either smart profile is not in the request body or no individual profile is connected for user: ${id}`,
        );
        return res.status(400).json({ error: 'Bad request' });
      }
    } catch (error: any) {
      Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  },
);

smartProfileRouter.post(
  '/exchange-profile',
  isAuthenticated,
  isValidAttestation,
  [
    body('smartProfile').custom((value) => {
      // Ensure the object is an instance of SmartProfile
      if (!(plainToInstance(SmartProfile, JSON.parse(JSON.stringify(value))) instanceof SmartProfile)) {
        throw new Error('smartProfile must be an instance of SmartProfile');
      }
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    try {
      // load dynamically from header
      // add a check if this profileTypeStreamId exists in client app table
      const { smartProfile: reqSmartProfile } = req.body;
      if (!req.headers['x-profile-type-stream-id'] || typeof req.headers['x-profile-type-stream-id'] !== 'string') {
        Logger.error(`Fatal error due to missing profile type stream id`);
        return res.status(400).json({ errors: 'profile type stream id is missing' });
      }
      if (!req.headers['x-client-app-id'] || typeof req.headers['x-client-app-id'] !== 'string') {
        Logger.error(`Fatal error due to missing client app id`);
        return res.status(400).json({ errors: 'client app id is missing' });
      }
      const clientAppId = req.headers['x-client-app-id'];
      const profileTypeStreamId = req.headers['x-profile-type-stream-id'];
      const id = req?.user?.uniqueSessionId;
      const memorySmartProfile = memoryStoreProfile.get(id)?.smartProfile;
      // profile exchange workflow - profiles are present in both request and memory
      if (memorySmartProfile && !(Object.keys(reqSmartProfile).length === 0) && profileTypeStreamId) {
        Logger.info(`Profile exchange workflow for user: ${req?.user?.id}`);
        const smartProfile = normalizeSmartProfile(plainToInstance(SmartProfile, reqSmartProfile));

        // this is not the first time this profile is being created - make sure the profile mapping exists in our database
        const profileMapping = await smartProfileMapRepository.findOne({
          where: {
            userId: req?.user?.id,
            profileTypeStreamId: profileTypeStreamId,
          },
        });
        // Check credits BEFORE any DB changes (prevent orphaned profiles)
        const creditCheckPlatform = await checkCreditsBeforeAttestation(clientAppId);
        if (!creditCheckPlatform.hasSufficientCredits) {
          Logger.error(`Insufficient credits for platform connection - client: ${clientAppId}`);
          memoryStoreProfile.delete(id);
          return res.status(402).json(creditCheckPlatform.errorResponse);
        }

        if (!profileMapping) {
          // there must be something wrong if this mapping does not exist, this is a corner case but we create the mapping
          Logger.info(`The older version of this profile was not found in profile mapping table, This is not normal`);
          // Create profile mapping (profile data is in attestation, only store index)
          const newSmartProfileMap = await smartProfileMapRepository.create({
            profileTypeStreamId: profileTypeStreamId,
            userId: req?.user?.id,
          });

          await smartProfileMapRepository.save(newSmartProfileMap);
          Logger.info(`Smart profile created for user id: ${req?.user?.id}`);
        } else {
          // profile mapping found, everything is okay
          Logger.info(`Smart profile found for user id: ${req?.user?.id}`);
        }

        // Ensure scores is properly initialized as an array (fix for "scores.map is not a function" error)
        // scores should be Score[] array, not Map or plain object
        if (smartProfile.scores && !Array.isArray(smartProfile.scores)) {
          // Convert object to array if it came as plain object from JSON
          if (typeof smartProfile.scores === 'object') {
            const scoresArray: { scoreType: string; scoreValue: number }[] = [];
            Object.entries(smartProfile.scores).forEach(([key, value]: [string, any]) => {
              if (value && typeof value === 'object' && 'scoreType' in value) {
                scoresArray.push(value);
              } else {
                scoresArray.push({ scoreType: key, scoreValue: Number(value) || 0 });
              }
            });
            smartProfile.scores = scoresArray;
          }
        }

        if (
          smartProfile.connectedPlatforms.includes(
            memorySmartProfile?.privateData.attestedPlatformIds.connectedProfiles[0]?.platformType,
          )
        ) {
          // If this platform is already connected there is no need to add this one to profile
          Logger.info(
            `The profile is already connected: ${memorySmartProfile?.privateData.attestedPlatformIds.connectedProfiles[0]?.platformType}`,
          );
          memoryStoreProfile.delete(id);
          return res.status(400).json({ error: 'Bad request' });
        }
        // Calculate the social score based on the input profiles data
        const socialScore = calculateSocialScore(
          memorySmartProfile?.privateData.attestedPlatformIds.connectedProfiles,
          smartProfile?.privateData.attestedPlatformIds.connectedProfiles,
        );
        memorySmartProfile.updateScoreValue(ScoreTypes.socialScore, socialScore);

        // Now we aggregate profiles
        smartProfile.aggregateProfile(memorySmartProfile);
        smartProfile.connectedPlatforms = smartProfile?.privateData.attestedPlatformIds.connectedProfiles.map(
          (profile) => {
            return profile.platformType;
          },
        );
        memoryStoreProfile.delete(id);

        const existingUser = await userRepository.findOne({
          where: {
            id: req?.user?.id,
          },
        });

        // Create on-chain attestation on Oasis Sapphire
        const attestationResult = await pluralityAttestation.attestSmartProfileOnChain(
          smartProfile,
          existingUser?.metamaskAddress || '',
          process.env.SAPPHIRE_PUBLIC_SCHEMA_UID || '',
          process.env.SAPPHIRE_PRIVATE_SCHEMA_UID || '',
        );

        // Deduct credits after successful attestation
        await deductCreditsAfterAttestation(
          clientAppId,
          {
            publicAttestationUID: attestationResult.publicAttestationUID,
            privateAttestationUID: attestationResult.privateAttestationUID,
            totalGasCost: attestationResult.totalGasCost,
          },
          req?.user?.id
        );

        Logger.info(`Platform connection attestation created - onchainUID: ${attestationResult.publicAttestationUID}`);

        // Save attestation UIDs to smart_profile_map
        // NOTE: Do NOT store privateData here - it's plain data from aggregation
        // Encrypted privateData will be stored via /store-private-data endpoint
        const updateDataPlatform: any = {
          onchainAttestationUID: attestationResult.publicAttestationUID,
          privateAttestationUID: attestationResult.privateAttestationUID,
          attestationChain: 'sapphire',
          attestationTxHash: attestationResult.transactionHashes[0],
          attestationTimestamp: Date.now(),
        };

        await smartProfileMapRepository.update(
          { userId: req?.user?.id, profileTypeStreamId },
          updateDataPlatform,
        );

        const smartProfileResponse = JSON.parse(JSON.stringify(smartProfile));
        smartProfileResponse.onchainAttestationUID = attestationResult.publicAttestationUID;
        smartProfileResponse.privateAttestationUID = attestationResult.privateAttestationUID;
        smartProfileResponse.attestationTxHash = attestationResult.transactionHashes[0];
        smartProfileResponse.chainId = attestationResult.chainId;

        return res.status(200).json({
          success: true,
          smartProfile: smartProfileResponse
        });
      } else {
        Logger.error(`Bad request for exchange-profile - user: ${id}`);
        return res.status(400).json({ error: 'Bad request' });
      }
    } catch (error: any) {
      Logger.error(`Error in exchange-profile: ${error?.message || JSON.stringify(error)}`);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  },
);

// Store privateData in Sapphire confidential contract (called by frontend after attestation succeeds)
smartProfileRouter.post(
  '/store-private-data',
  isAuthenticated,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    try {
      const { privateData } = req.body;
      const clientAppId = req.headers['x-client-app-id'] as string;

      if (!privateData) {
        Logger.error(`Missing privateData in store-private-data request`);
        return res.status(400).json({ error: 'Missing privateData' });
      }

      // Fetch user from database to get metamaskAddress (JWT only contains id)
      const existingUser = await userRepository.findOne({
        where: { id: req?.user?.id },
      });

      if (!existingUser?.metamaskAddress) {
        Logger.error(`User not found or missing metamaskAddress for user id: ${req?.user?.id}`);
        return res.status(400).json({ error: 'User wallet address not found' });
      }

      const userAddress = existingUser.metamaskAddress;

      const sapphireStorage = getSapphirePrivateStorage();

      // Check if Sapphire storage is enabled
      if (!sapphireStorage.isEnabled()) {
        Logger.error('Sapphire private storage not configured');
        return res.status(503).json({ error: 'Private storage service unavailable' });
      }

      // Check credits before storing
      if (clientAppId && prepaidCreditService.isEnabled()) {
        const estimatedGas = await sapphireStorage.estimateStoreGas();
        const creditCheck = await prepaidCreditService.checkSufficientCredits(clientAppId, estimatedGas);

        if (!creditCheck.hasSufficient) {
          Logger.warn(`Insufficient credits for client ${clientAppId}`);
          return res.status(402).json({ error: 'Insufficient credits' });
        }
      }

      // Store in Sapphire confidential contract
      Logger.info(`Storing privateData in Sapphire for user: ${userAddress}`);
      const { txHash, gasUsed } = await sapphireStorage.store(userAddress, privateData);

      // Deduct credits after successful storage
      if (clientAppId && prepaidCreditService.isEnabled()) {
        await prepaidCreditService.deductCredits(clientAppId, gasUsed, txHash);
      }

      Logger.info(`Private data stored in Sapphire for user: ${userAddress}, txHash: ${txHash}`);
      return res.status(200).json({ success: true, txHash });
    } catch (error: any) {
      Logger.error(`Error storing private data in Sapphire: ${error?.message || JSON.stringify(error)}`);
      return res.status(500).json({ error: 'Failed to store private data' });
    }
  }
);
