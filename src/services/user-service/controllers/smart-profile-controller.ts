import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import { isAuthenticated } from '../../oauth-service/middlewares/oauth-middleware';
import { memoryStoreProfile, ScoreTypes } from '../../../utils/global';
import { calculateSocialScore } from '../utils/score';
import { plainToInstance } from 'class-transformer';
import { SmartProfileMap } from '../entity/smart-profile-map';
import { EarlyUser } from '../entity/early-user';
import { ClientApp } from '../../crm-service/entity/client-app';
import { isValidAttestation } from '../middlewares/auth-middleware';
import { User } from '../entity/user';
import { normalizeSmartProfile, PluralityEas, SmartProfile } from 'plurality-eas';


export const smartProfileRouter = express.Router();
dotenv.config();
const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);
const earlyUserRepository = AppDataSource.getRepository(EarlyUser);
const clientAppRepository = AppDataSource.getRepository(ClientApp);
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

const pluralityEas = new PluralityEas({
  privateKey: process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || "",
  easContractAddress: process.env.EAS_CONTRACT_ADDRESS || "",
  rpcProvider: process.env.EAS_BLOCKCHAIN_RPC || ""
})


smartProfileRouter.put(
  '/',
  isAuthenticated,
  isValidAttestation,
  [
    body('data.username').optional().trim().isLength({ max: 50 }),
    body('data.bio').optional().trim().isLength({ max: 300 }),
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
        if (!base64Pattern.test(value)) {
          throw new Error('Profile image must be a base64 encoded image');
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
      const profileTypeStreamId = req.headers['x-profile-type-stream-id'];
      const existingClient = await clientAppRepository.findOne({ where: { streamId: profileTypeStreamId } });
      if (!existingClient) {
        Logger.error(`Client id not found`);
        return res.status(400).json({ error: 'Client id not found' });
      }
      const userUpdateReqData = JSON.parse(JSON.stringify(req.body.data));
      const smartProfile = normalizeSmartProfile(req?.body?.smartProfile);
      const id = req?.user?.id;
      // get from smartProfileMap
      const existingUser = await smartProfileMapRepository.findOne({
        where: {
          userId: id,
          profileTypeStreamId: profileTypeStreamId,
        },
      });

      if (existingUser) {
        Logger.info(`This user exists in database! email: ${existingUser.email}`);
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

          const updatedUser = {
            username: userUpdateReqData.username || smartProfile?.username,
            avatar: uploadResult?.secure_url || smartProfile?.avatar,
            bio: userUpdateReqData.bio || smartProfile?.bio,
          };

          // Update the existing profile
          await smartProfileMapRepository.update({ id: existingUser.id }, updatedUser);
          Logger.info(`Smart profile updated locally for user id: ${id}`);
          // attest profile
          const user = await userRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });
          const attestedSmartProfile = await pluralityEas.attestSmartProfile(user?.id, smartProfile, user?.pkpAddress,process.env.PUBLIC_SCHEMA_UID,process.env.PRIVATE_SCHEMA_UID);
          return res.status(200).json({ success: true, smartProfile: attestedSmartProfile });
        } else {
          Logger.error(`user profile not found on body`);
          return res.status(400).json({ success: false, error: 'user profile not found in the body' });
        }
      } else {
        // User with this profile does not exist
        Logger.info(`This user with this profile does not exist!`);
        return res.status(404).json({ exists: false });
      }
    } catch (e) {
      // If an error occurs during the database query, return an error response
      Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
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
      const profileTypeStreamId = req.headers['x-profile-type-stream-id'];
      const { smartProfile: reqSmartProfile } = req.body;
      if (!profileTypeStreamId) {
        Logger.error(`Fatal error due to missing profile type stream id`);
        return res.status(400).json({ errors: 'profile type stream id is missing' });
      }
      const existingClient = await clientAppRepository.findOne({ where: { streamId: profileTypeStreamId } });
      if (!existingClient) {
        Logger.error(`Client id not found`);
        return res.status(400).json({ error: 'Client id not found' });
      }
      const id = req?.user?.uniqueSessionId;
      const memorySmartProfile = memoryStoreProfile.get(id);
      // profile exchange workflow - profiles are present in both request and memory
      if (memorySmartProfile && !(Object.keys(reqSmartProfile).length === 0) && profileTypeStreamId) {
        Logger.info(`Profile exchange workflow`);
        const smartProfile = normalizeSmartProfile(plainToInstance(SmartProfile, reqSmartProfile));

        // this is not the first time this profile is being created - make sure the profile mapping exists in our database
        const profileMapping = await smartProfileMapRepository.findOne({
          where: {
            userId: req?.user?.id,
            profileTypeStreamId: profileTypeStreamId,
          },
        });
        if (!profileMapping) {
          // there must be something wrong if this mapping does not exist, this is a corner case but we create the mapping
          Logger.info(`The older version of this profile was not found in profile mapping table, This is not normal`);
          const newSmartProfileMap = await smartProfileMapRepository.create({
            username: smartProfile?.username,
            avatar: smartProfile?.avatar,
            bio: smartProfile?.bio,
            connectedProfiles: smartProfile?.privateData.attestedPlatformIds.connectedProfiles,
            scores: smartProfile?.scores,
            profileTypeStreamId: profileTypeStreamId,
            userId: req?.user?.id,
          });

          await smartProfileMapRepository.save(newSmartProfileMap);
          Logger.info(`Smart profile created for user id: ${req?.user?.id}`);
        } else {
          // profile mapping found, everything is okay
          Logger.info(`Smart profile found for user id: ${req?.user?.id}`);
        }

        // check if the current platform is already connected
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

        const updatedSmartProfileMap = {
          connectedProfiles: smartProfile?.privateData.attestedPlatformIds.connectedProfiles,
          scores: smartProfile?.scores,
        };

        // Update the profiles mapping table with updated profile
        await smartProfileMapRepository.update(
          { userId: req?.user?.id, profileTypeStreamId: profileTypeStreamId },
          updatedSmartProfileMap,
        );
        Logger.info(`Smart profile updated for user id: ${req?.user?.id}`);

        // profile attestation
        const existingUser = await userRepository.findOne({
          where: {
            id: req?.user?.id,
          },
        });
        const attestedSmartProfile = await pluralityEas.attestSmartProfile(
          req?.user?.id,
          smartProfile,
          existingUser?.pkpAddress || '',
          process.env.PUBLIC_SCHEMA_UID || "",
          process.env.PRIVATE_SCHEMA_UID || ""
        );
        return res.status(200).json({ success: true, smartProfile: attestedSmartProfile });
      }
      // new profile creation
      else if (!memorySmartProfile && Object.keys(reqSmartProfile).length === 0 && profileTypeStreamId) {
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
          });
          newProfile.updateScoreValue(
            ScoreTypes.socialScore,
            earlyUser?.username ? 1000 : Number(process.env.DEFAULT_SOCIAL_SCORE),
          );

          const newSmartProfileMap = await smartProfileMapRepository.create({
            username: newProfile?.username,
            avatar: newProfile?.avatar,
            bio: newProfile?.bio,
            connectedProfiles: [],
            scores: newProfile?.scores,
            profileTypeStreamId: profileTypeStreamId,
            userId: req?.user?.id,
          });
          console.log(newSmartProfileMap);
          await smartProfileMapRepository.save(newSmartProfileMap);
          Logger.info(`New smart profile created for user id: ${id}`);
          // profile attestation
          const existingUser = await userRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });
          const attestedSmartProfile = await pluralityEas.attestSmartProfile(
            req?.user?.id,
            newProfile,
            existingUser?.pkpAddress || '',
            process.env.PUBLIC_SCHEMA_UID || "",
            process.env.PRIVATE_SCHEMA_UID || ""
          );
          return res.status(200).json({ success: true, smartProfile: attestedSmartProfile });
        } else {
          // if profile map exists in database we return the smart profile based on the map
          Logger.info(`Profile map already found in database`);
          const oldProfile = new SmartProfile({
            username: profileMapping?.username ? profileMapping?.username : faker.person.lastName().toLocaleLowerCase(),
            avatar: profileMapping?.avatar
              ? profileMapping?.avatar
              : 'https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png',
            //scores: profileMapping?.scores,
            connectedProfiles: profileMapping?.connectedProfiles,
            connectedPlatforms: profileMapping?.connectedProfiles?.map((profile) => {
              return profile.platformName;
            }),
          });
          // need to set this explicitly
          oldProfile.scores = profileMapping?.scores;
          Logger.info(`Old version of smart profile returned from profile map: ${id}, This is not normal workflow`);
          // profile attestation
          const existingUser = await userRepository.findOne({
            where: {
              id: req?.user?.id,
            },
          });

          const attestedSmartProfile = await pluralityEas.attestSmartProfile(
            req?.user?.id,
            oldProfile,
            existingUser?.pkpAddress || '',
            process.env.PUBLIC_SCHEMA_UID || "",
            process.env.PRIVATE_SCHEMA_UID || ""
          );
          return res.status(200).json({ success: true, smartProfile: attestedSmartProfile });
        }
      } else {
        Logger.error(
          `Either smart profile is not in the request body or no individual profile is connected for user: ${id}`,
        );
        return res.status(400).json({ error: 'Bad request' });
      }
    } catch (error) {
      Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  },
);
