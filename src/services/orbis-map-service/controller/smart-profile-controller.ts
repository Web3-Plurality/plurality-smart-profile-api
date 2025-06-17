import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { SmartProfileOrbis } from '../entity/smart-profile';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';

dotenv.config();

export const smartProfileOrbisRouter = express.Router();

// Get the SmartProfileOrbis repository
const smartProfileOrbisRepository = AppDataSource.getRepository(SmartProfileOrbis);

// POST /smart-profiles - Insert a new smart profile
smartProfileOrbisRouter.post('/', async (req: Request, res: Response) => {
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

    // Create new smart profile
    const newSmartProfile = smartProfileOrbisRepository.create({
      username: username || '',
      avatar: avatar || '',
      bio: bio || '',
      scores: scores || '',
      connectedPlatforms: connectedPlatforms || '',
      profileTypeStreamId: profileTypeStreamId || '',
      version: version || '2.0',
      extendedPublicData: extendedPublicData || '',
      attestation: attestation || '',
      privateData: privateData || '',
    });

    // Save to database
    const savedSmartProfile = await smartProfileOrbisRepository.save(newSmartProfile);

    Logger.info(`Smart profile created successfully with ID: ${savedSmartProfile.id}`);

    return res.status(201).json({
      success: true,
      message: 'Smart profile created successfully',
      data: savedSmartProfile,
    });
  } catch (error: any) {
    Logger.error(`Error creating smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while creating the smart profile',
    });
  }
});

// GET /smart-profiles - Get all smart profiles
smartProfileOrbisRouter.get('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const smartProfiles = await smartProfileOrbisRepository.find({
      order: {
        username: 'ASC',
      },
    });

    Logger.info(`Retrieved ${smartProfiles.length} smart profiles`);

    return res.status(200).json({
      success: true,
      data: smartProfiles,
      count: smartProfiles.length,
    });
  } catch (error: any) {
    Logger.error(`Error retrieving smart profiles: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving smart profiles',
    });
  }
});

// GET /smart-profiles/:id - Get a specific smart profile by ID
smartProfileOrbisRouter.get('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid ID format. Please provide a valid UUID.',
      });
    }

    const smartProfile = await smartProfileOrbisRepository.findOne({
      where: { id },
    });

    if (!smartProfile) {
      return res.status(404).json({
        error: 'Smart profile not found',
      });
    }

    Logger.info(`Retrieved smart profile with ID: ${id}`);

    return res.status(200).json({
      success: true,
      data: smartProfile,
    });
  } catch (error: any) {
    Logger.error(`Error retrieving smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving the smart profile',
    });
  }
});

// PUT /smart-profiles/:id - Update a specific smart profile
smartProfileOrbisRouter.put('/:id', async (req: Request, res: Response) => {
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
      userDid,
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
    if (scores !== undefined) updateData.scores = scores;
    if (connectedPlatforms !== undefined) updateData.connectedPlatforms = connectedPlatforms;
    if (profileTypeStreamId !== undefined) updateData.profileTypeStreamId = profileTypeStreamId;
    if (version !== undefined) updateData.version = version;
    if (extendedPublicData !== undefined) updateData.extendedPublicData = extendedPublicData;
    if (attestation !== undefined) updateData.attestation = attestation;
    if (privateData !== undefined) updateData.privateData = privateData;
    if (userDid !== undefined) updateData.userDid = userDid;
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

    Logger.info(`Smart profile updated successfully with ID: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Smart profile updated successfully',
      data: updatedSmartProfile,
    });
  } catch (error: any) {
    Logger.error(`Error updating smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while updating the smart profile',
    });
  }
});

// DELETE /smart-profiles/:id - Delete a specific smart profile
smartProfileOrbisRouter.delete('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Smart Profile Orbis']
  try {
    const { id } = req.params;

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

    // Delete the smart profile
    const deleteResult = await smartProfileOrbisRepository.delete(id);

    if (deleteResult.affected === 0) {
      return res.status(404).json({
        error: 'Smart profile not found',
      });
    }

    Logger.info(`Smart profile deleted successfully with ID: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Smart profile deleted successfully',
    });
  } catch (error: any) {
    Logger.error(`Error deleting smart profile: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while deleting the smart profile',
    });
  }
});
