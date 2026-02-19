import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { SmartProfileMap } from '../../user-service/entity/smart-profile-map';
import { User } from '../../user-service/entity/user';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';
import { PluralityAttestation, ProfilePrivateData } from '@plurality-network/smart-profile-utils';
import { getSapphirePrivateStorage } from '../../sapphire-service/sapphire-private-storage';

dotenv.config();

export const smartProfileOrbisRouter = express.Router();

const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);

// On-chain attestation instance (Oasis Sapphire)
const pluralityAttestation = new PluralityAttestation({
  signerPrivateKey: process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '',
  signerAddress: process.env.PUBLIC_DAPP_OWNER_WALLET_ADDRESS || '',
  easContractAddress: process.env.SAPPHIRE_EAS_ADDRESS || '',
  rpcProvider: process.env.SAPPHIRE_RPC || '',
});

// GET /smart-profiles/by-mapping/:profileTypeId/:userId - Get smart profile by userId and profileTypeId
smartProfileOrbisRouter.get('/by-mapping/:profileTypeId/:userId', async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const { profileTypeId, userId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileTypeId)) {
      return res.status(400).json({ error: 'Invalid profileTypeId format. Please provide a valid UUID.' });
    }

    if (!userId || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required and cannot be empty.' });
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

    // If both attestation UIDs exist, fetch profile from blockchain
    if (profileMapping.onchainAttestationUID && profileMapping.privateAttestationUID) {
      Logger.info(
        `Profile exists on blockchain - fetching from chain using attestationUIDs: ` +
          `onchain=${profileMapping.onchainAttestationUID}, private=${profileMapping.privateAttestationUID}`,
      );

      try {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });

        if (!user || !user.metamaskAddress) {
          Logger.error(`User not found or missing MetaMask address for userId: ${userId}`);
          return res.status(404).json({ success: false, error: 'User not found or missing MetaMask address' });
        }

        const metamaskAddress = user.metamaskAddress;

        const { isValid, profile } = await pluralityAttestation.verifyAndReconstructProfile(
          profileMapping.onchainAttestationUID,
          profileMapping.privateAttestationUID,
          metamaskAddress,
        );

        if (!isValid || !profile) {
          Logger.error(`Failed to verify or reconstruct profile from blockchain`);
          return res.status(500).json({ success: false, error: 'Failed to verify profile attestation from blockchain' });
        }

        Logger.info(`Successfully fetched and verified profile from blockchain`);

        // Fetch private data from Sapphire confidential contract
        const sapphireStorage = getSapphirePrivateStorage();

        if (sapphireStorage.isEnabled()) {
          try {
            const privateData = await sapphireStorage.retrieve(metamaskAddress);

            if (privateData) {
              Logger.info(`Found private data in Sapphire for user: ${metamaskAddress}`);
              return res.status(200).json({
                success: true,
                newUser: false,
                data: { ...profile, privateData },
              });
            }
          } catch (sapphireError: any) {
            Logger.warn(`Sapphire retrieval failed, continuing with empty privateData: ${sapphireError.message}`);
          }
        }

        // No private data found - return profile with empty privateData
        Logger.warn(`No private data found in Sapphire, returning profile with empty privateData`);
        profile.privateData = new ProfilePrivateData();

        return res.status(200).json({ success: true, newUser: false, data: profile });
      } catch (error: any) {
        Logger.error(`Error fetching profile from blockchain: ${error?.message || JSON.stringify(error)}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch profile from blockchain',
          details: error?.message || 'Unknown error',
        });
      }
    } else if (profileMapping.onchainAttestationUID) {
      // Only onchain UID exists (no private UID) - incomplete profile
      Logger.warn(`Profile has onchain UID but missing private UID - treating as new user`);
      return res.status(200).json({
        success: true,
        newUser: true,
        message: 'Profile incomplete. Please complete onboarding again.',
      });
    } else {
      // No attestation UIDs - new user
      Logger.info(`No attestation UIDs found for userId: ${userId}, treating as new user`);
      return res.status(200).json({ success: true, newUser: true, message: 'No smart profile found' });
    }
  } catch (error: any) {
    Logger.error(`Error retrieving smart profile by mapping: ${error?.message || JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while retrieving the smart profile by mapping' });
  }
});
