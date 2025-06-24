import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { SmartProfileOrbis } from '../entity/smart-profile';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';

dotenv.config();

export const smartProfileOrbisRouter = express.Router();

// Get the SmartProfileOrbis repository
const smartProfileOrbisRepository = AppDataSource.getRepository(SmartProfileOrbis);
// // Get the ProfileTypeSmartProfileMap repository
// const profileTypeSmartProfileMapRepository = AppDataSource.getRepository(ProfileTypeSmartProfileMap);

// POST /smart-profiles - Insert a new smart profile
smartProfileOrbisRouter.post('/', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const {
      username,
      avatar,
      bio,
      scores,
      connectedPlatforms,
      profileTypeStreamId,
      version,
      extendedPublicData,
      attestation,
      privateData,
    } = req.body;

    const userId = req.user?.id;
    // Create new smart profile
    const newSmartProfile = smartProfileOrbisRepository.create({
      username: username || '',
      avatar: avatar || '',
      bio: bio || '',
      scores: JSON.stringify(scores) || '',
      connectedPlatforms: JSON.stringify(connectedPlatforms) || '',
      profileTypeStreamId: profileTypeStreamId || '',
      version: version || '2.0',
      extendedPublicData: JSON.stringify(extendedPublicData) || '',
      attestation: JSON.stringify(attestation) || '',
      privateData: JSON.stringify(privateData) || '',
      userId: userId,
    });

    // Save to database
    const savedSmartProfile = await smartProfileOrbisRepository.save(newSmartProfile);

    Logger.info(`Smart profile created successfully with ID: ${savedSmartProfile.id}`);
    const { userId: id, ...smartProfileData } = savedSmartProfile;

    return res.status(201).json({
      success: true,
      message: 'Smart profile created successfully',
      data: smartProfileData,
    });
  } catch (error: any) {
    Logger.error(`Error creating smart profile: ${JSON.stringify(error)}`);
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
smartProfileOrbisRouter.put('/:id', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const { id } = req.params;
    const {
      username,
      avatar,
      bio,
      scores,
      connectedPlatforms,
      profileTypeStreamId,
      version,
      extendedPublicData,
      attestation,
      privateData,
    } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid ID format. Please provide a valid UUID.',
      });
    }

    // Check if smart profile exists
    const existingSmartProfile = await smartProfileOrbisRepository.findOne({
      where: { id },
    });

    if (!existingSmartProfile) {
      return res.status(404).json({
        error: 'Smart profile not found',
      });
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (scores !== undefined) updateData.scores = JSON.stringify(scores);
    if (connectedPlatforms !== undefined) updateData.connectedPlatforms = JSON.stringify(connectedPlatforms);
    if (profileTypeStreamId !== undefined) updateData.profileTypeStreamId = profileTypeStreamId;
    if (version !== undefined) updateData.version = version;
    if (extendedPublicData !== undefined) updateData.extendedPublicData = JSON.stringify(extendedPublicData);
    if (attestation !== undefined) updateData.attestation = JSON.stringify(attestation);
    if (privateData !== undefined) updateData.privateData = JSON.stringify(privateData);

    // Update the smart profile
    const updateResult = await smartProfileOrbisRepository.update(id, updateData);

    if (updateResult.affected === 0) {
      return res.status(404).json({
        error: 'Smart profile not found or no changes made',
      });
    }

    // Fetch the updated smart profile
    const updatedSmartProfile = await smartProfileOrbisRepository.findOne({
      where: { id },
    });
    if (updatedSmartProfile) {
      Logger.info(`Smart profile updated successfully with ID: ${id}`);
      const { userId, ...smartProfileData } = updatedSmartProfile;
      return res.status(200).json({
        success: true,
        message: 'Smart profile updated successfully',
        data: smartProfileData,
    });
    }
    else {
      return res.status(404).json({
        error: 'Error updating smart profile, please try again',
      });
    }
  } catch (error: any) {
    Logger.error(`Error updating smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while updating the smart profile',
    });
  }
});

// GET /smart-profiles/by-mapping/:profileTypeId/:userDid - Get smart profile by userDid and profileTypeId
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

    // Validate userDid is provided
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'userId is required and cannot be empty.',
      });
    }

    // If mapping exists, get the smart profile
    const smartProfile = await smartProfileOrbisRepository.findOne({
      where: { userId: userId, profileTypeStreamId: profileTypeId },
    });

    if (!smartProfile) {
      return res.status(200).json({
        success: true,
        newUser: true,
        message: 'No smart profile found for the provided userId and profileTypeId',
      });
    }

    Logger.info(
      `Retrieved smart profile via mapping - userId: ${userId}, profileTypeId: ${profileTypeId}, smartProfileId: ${smartProfile.id}`,
    );

    const { userId: id, ...smartProfileData } = smartProfile;
    return res.status(200).json({
      success: true,
      newUser: false,
      data: smartProfileData,
    });
  } catch (error: any) {
    Logger.error(`Error retrieving smart profile by mapping: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving the smart profile by mapping',
    });
  }
});
