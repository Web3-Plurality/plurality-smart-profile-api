import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { SmartProfileOrbis } from '../entity/smart-profile';
import { SmartProfileMap } from '../../user-service/entity/smart-profile-map';
import { User } from '../../user-service/entity/user';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';
import { PluralityAttestation, ProfilePrivateData } from '@plurality-network/smart-profile-utils';
import { getSapphirePrivateStorage } from '../../sapphire-service/sapphire-private-storage';

dotenv.config();

export const smartProfileOrbisRouter = express.Router();

// Get the SmartProfileOrbis repository
const smartProfileOrbisRepository = AppDataSource.getRepository(SmartProfileOrbis);
const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);

// On-chain attestation instance (Oasis Sapphire)
const pluralityAttestation = new PluralityAttestation({
  signerPrivateKey: process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '',
  signerAddress: process.env.PUBLIC_DAPP_OWNER_WALLET_ADDRESS || '',
  easContractAddress: process.env.SAPPHIRE_EAS_ADDRESS || '',
  rpcProvider: process.env.SAPPHIRE_RPC || '',
});

// POST /smart-profiles - Insert a new smart profile
// NOTE: This endpoint is deprecated. All profiles are now stored on-chain via attestations.
// The orbis_smart_profiles table is kept for legacy data only.
smartProfileOrbisRouter.post('/', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    Logger.info(`On-chain mode: Skipping orbis_smart_profiles write, returning success response`);
    return res.status(201).json({
      success: true,
      message: 'Smart profile created successfully (on-chain mode)',
      data: {
        id: 'onchain',
        ...req.body,
      },
    });
  } catch (error: any) {
    Logger.error(`Error in POST smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while creating the smart profile',
    });
  }
});

// GET /smart-profiles/:id - Get a specific smart profile by ID
// smartProfileOrbisRouter.get('/:id', async (req: Request, res: Response) => {
//   // #swagger.tags = ['Smart Profile Orbis']
//   try {
//     const { id } = req.params;

//     // Validate UUID format
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//     if (!uuidRegex.test(id)) {
//       return res.status(400).json({
//         error: 'Invalid ID format. Please provide a valid UUID.',
//       });
//     }

//     const smartProfile = await smartProfileOrbisRepository.findOne({
//       where: { id },
//     });

//     if (!smartProfile) {
//       return res.status(404).json({
//         error: 'Smart profile not found',
//       });
//     }

//     Logger.info(`Retrieved smart profile with ID: ${id}`);

//     return res.status(200).json({
//       success: true,
//       data: smartProfile,
//     });
//   } catch (error: any) {
//     Logger.error(`Error retrieving smart profile: ${JSON.stringify(error)}`);
//     return res.status(500).json({
//       error: 'An error occurred while retrieving the smart profile',
//     });
//   }
// });

// PUT /smart-profiles/:id - Update a specific smart profile
// NOTE: This endpoint is deprecated. All profiles are now stored on-chain via attestations.
// The orbis_smart_profiles table is kept for legacy data only.
smartProfileOrbisRouter.put('/:id', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    Logger.info(`On-chain mode: Skipping orbis_smart_profiles update, returning success response`);
    return res.status(200).json({
      success: true,
      message: 'Smart profile updated successfully (on-chain mode)',
      data: {
        id: req.params.id,
        ...req.body,
      },
    });
  } catch (error: any) {
    Logger.error(`Error in PUT smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while updating the smart profile',
    });
  }
});

// GET /smart-profiles/by-mapping/:profileTypeId/:userId - Get smart profile by userId and profileTypeId
smartProfileOrbisRouter.get('/by-mapping/:profileTypeId/:userId', async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const { profileTypeId, userId } = req.params;

    // Validate UUID format for profileTypeId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileTypeId)) {
      return res.status(400).json({
        error: 'Invalid profileTypeId format. Please provide a valid UUID.',
      });
    }

    // Validate userId is provided
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'userId is required and cannot be empty.',
      });
    }

    // Look up attestation UIDs from smart_profile_map
    const profileMapping = await smartProfileMapRepository.findOne({
      where: { userId: userId, profileTypeStreamId: profileTypeId },
    });

    if (!profileMapping) {
      return res.status(200).json({
        success: true,
        newUser: true,
        message: 'No smart profile found for the provided userId and profileTypeId',
      });
    }

    // If attestation UID exists, fetch profile from blockchain
    if (profileMapping.onchainAttestationUID && profileMapping.privateAttestationUID) {
      Logger.info(
        `Profile exists on blockchain - fetching from chain using attestationUIDs: ` +
          `onchain=${profileMapping.onchainAttestationUID}, private=${profileMapping.privateAttestationUID}`,
      );

      try {
        // Fetch user's MetaMask address to verify attestation
        const user = await AppDataSource.getRepository(User).findOne({
          where: { id: userId },
        });

        if (!user || !user.metamaskAddress) {
          Logger.error(`User not found or missing MetaMask address for userId: ${userId}`);
          return res.status(404).json({
            success: false,
            error: 'User not found or missing MetaMask address',
          });
        }

        const metamaskAddress = user.metamaskAddress;

        // Fetch and verify profile from blockchain
        const { isValid, profile } = await pluralityAttestation.verifyAndReconstructProfile(
          profileMapping.onchainAttestationUID,
          profileMapping.privateAttestationUID,
          metamaskAddress,
        );

        if (!isValid || !profile) {
          Logger.error(`Failed to verify or reconstruct profile from blockchain`);
          return res.status(500).json({
            success: false,
            error: 'Failed to verify profile attestation from blockchain',
          });
        }

        Logger.info(`Successfully fetched and verified profile from blockchain`);

        // Fetch private data from Sapphire confidential contract
        const sapphireStorage = getSapphirePrivateStorage();

        if (sapphireStorage.isEnabled()) {
          try {
            const privateData = await sapphireStorage.retrieve(metamaskAddress);

            if (privateData) {
              Logger.info(`Found private data in Sapphire for user: ${metamaskAddress}`);
              // Return profile with private data from Sapphire (already decrypted)
              return res.status(200).json({
                success: true,
                newUser: false,
                data: {
                  ...profile,
                  privateData,  // Already plaintext from Sapphire
                },
              });
            }
          } catch (sapphireError: any) {
            Logger.warn(`Sapphire retrieval failed, continuing with empty privateData: ${sapphireError.message}`);
          }
        }

        // No private data found - return profile with empty privateData
        Logger.warn(`No private data found in Sapphire, returning profile with empty privateData`);
        profile.privateData = new ProfilePrivateData();

        return res.status(200).json({
          success: true,
          newUser: false,
          data: profile,
        });
      } catch (error: any) {
        Logger.error(`Error fetching profile from blockchain: ${error?.message || JSON.stringify(error)}`);

        // Fallback to legacy table if blockchain fetch fails
        Logger.warn(`Blockchain fetch failed, falling back to legacy table`);
        const legacyProfile = await smartProfileOrbisRepository.findOne({
          where: { userId: userId, profileTypeStreamId: profileTypeId },
        });

        if (legacyProfile) {
          Logger.info(`Found profile in legacy table as fallback`);
          const { userId: id, ...smartProfileData } = legacyProfile;
          return res.status(200).json({
            success: true,
            newUser: false,
            data: smartProfileData,
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Failed to fetch profile from blockchain or legacy storage',
          details: error?.message || 'Unknown error',
        });
      }
    } else if (profileMapping.onchainAttestationUID) {
      // Only onchain UID exists (no private UID) - old profile created before migration fix
      // Fall back to legacy table
      Logger.warn(
        `Profile has onchain UID but missing private UID (old profile) - ` +
        `attestationUID: ${profileMapping.onchainAttestationUID}, ` +
        `falling back to legacy table`
      );

      const legacyProfile = await smartProfileOrbisRepository.findOne({
        where: { userId: userId, profileTypeStreamId: profileTypeId },
      });

      if (legacyProfile) {
        Logger.info(`Found old profile in legacy table`);
        const { userId: id, ...smartProfileData } = legacyProfile;
        return res.status(200).json({
          success: true,
          newUser: false,
          data: smartProfileData,
        });
      }

      // No legacy data - profile needs to be recreated
      Logger.warn(`No legacy data found for incomplete attestation`);
      return res.status(200).json({
        success: true,
        newUser: true,
        message: 'Profile needs to be recreated. Please complete onboarding again.',
      });
    } else {
      // Fallback: No attestation UIDs, try legacy orbis_smart_profiles table
      Logger.info(`No attestation UIDs found, checking legacy table for userId: ${userId}`);
      const smartProfile = await smartProfileOrbisRepository.findOne({
        where: { userId: userId, profileTypeStreamId: profileTypeId },
      });

      if (!smartProfile) {
        return res.status(200).json({
          success: true,
          newUser: true,
          message: 'No smart profile found',
        });
      }

      const { userId: id, ...smartProfileData } = smartProfile;
      return res.status(200).json({
        success: true,
        newUser: false,
        data: smartProfileData,
      });
    }
  } catch (error: any) {
    Logger.error(`Error retrieving smart profile by mapping: ${error?.message || JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving the smart profile by mapping',
    });
  }
});
