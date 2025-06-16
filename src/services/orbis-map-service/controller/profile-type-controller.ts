import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { ProfileTypeOrbis } from '../entity/profile-type';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';

dotenv.config();

export const profileTypeRouter = express.Router();

// Get the ProfileType repository
const profileTypeRepository = AppDataSource.getRepository(ProfileTypeOrbis);

// POST /profile-types - Insert a new profile type
profileTypeRouter.post('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const { profileName, description, platforms, version = '1.0' } = req.body;

    // Validate required fields
    if (!profileName || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: profileName and description are required' 
      });
    }

    // Create new profile type
    const newProfileType = profileTypeRepository.create({
      profileName,
      description,
      platforms: JSON.stringify(platforms) || '',
      version: version
    });

    // Save to database
    const savedProfileType = await profileTypeRepository.save(newProfileType);

    Logger.info(`Profile type created successfully with ID: ${savedProfileType.id}`);
    
    return res.status(201).json({
      success: true,
      message: 'Profile type created successfully',
      data: savedProfileType
    });

  } catch (error: any) {
    Logger.error(`Error creating profile type: ${JSON.stringify(error)}`);
    return res.status(500).json({ 
      error: 'An error occurred while creating the profile type' 
    });
  }
});

// GET /profile-types - Get all profile types
profileTypeRouter.get('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const profileTypes = await profileTypeRepository.find({
      order: {
        profileName: 'ASC'
      }
    });

    Logger.info(`Retrieved ${profileTypes.length} profile types`);
    
    return res.status(200).json({
      success: true,
      data: profileTypes,
      count: profileTypes.length
    });

  } catch (error: any) {
    Logger.error(`Error retrieving profile types: ${JSON.stringify(error)}`);
    return res.status(500).json({ 
      error: 'An error occurred while retrieving profile types' 
    });
  }
});

// GET /profile-types/:id - Get a specific profile type by ID
profileTypeRouter.get('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Invalid ID format. Please provide a valid UUID.' 
      });
    }

    const profileType = await profileTypeRepository.findOne({
      where: { id }
    });

    if (!profileType) {
      return res.status(404).json({ 
        error: 'Profile type not found' 
      });
    }

    Logger.info(`Retrieved profile type with ID: ${id}`);
    
    return res.status(200).json({
      success: true,
      data: profileType
    });

  } catch (error: any) {
    Logger.error(`Error retrieving profile type: ${JSON.stringify(error)}`);
    return res.status(500).json({ 
      error: 'An error occurred while retrieving the profile type' 
    });
  }
});

// PUT /profile-types/:id - Update a specific profile type
profileTypeRouter.put('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const { id } = req.params;
    const { profileName, description, platforms, version } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Invalid ID format. Please provide a valid UUID.' 
      });
    }

    // Check if profile type exists
    const existingProfileType = await profileTypeRepository.findOne({
      where: { id }
    });

    if (!existingProfileType) {
      return res.status(404).json({ 
        error: 'Profile type not found' 
      });
    }

    // Validate required fields
    if (!profileName || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: profileName and description are required' 
      });
    }

    // Update the profile type
    const updateResult = await profileTypeRepository.update(id, {
      profileName,
      description,
      platforms: JSON.stringify(platforms) || existingProfileType.platforms,
      version: version || existingProfileType.version
    });

    if (updateResult.affected === 0) {
      return res.status(404).json({ 
        error: 'Profile type not found or no changes made' 
      });
    }

    // Fetch the updated profile type
    const updatedProfileType = await profileTypeRepository.findOne({
      where: { id }
    });

    Logger.info(`Profile type updated successfully with ID: ${id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Profile type updated successfully',
      data: updatedProfileType
    });

  } catch (error: any) {
    Logger.error(`Error updating profile type: ${JSON.stringify(error)}`);
    return res.status(500).json({ 
      error: 'An error occurred while updating the profile type' 
    });
  }
});

// DELETE /profile-types/:id - Delete a specific profile type
profileTypeRouter.delete('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Invalid ID format. Please provide a valid UUID.' 
      });
    }

    // Check if profile type exists
    const existingProfileType = await profileTypeRepository.findOne({
      where: { id }
    });

    if (!existingProfileType) {
      return res.status(404).json({ 
        error: 'Profile type not found' 
      });
    }

    // Delete the profile type
    const deleteResult = await profileTypeRepository.delete(id);

    if (deleteResult.affected === 0) {
      return res.status(404).json({ 
        error: 'Profile type not found' 
      });
    }

    Logger.info(`Profile type deleted successfully with ID: ${id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Profile type deleted successfully'
    });

  } catch (error: any) {
    Logger.error(`Error deleting profile type: ${JSON.stringify(error)}`);
    return res.status(500).json({ 
      error: 'An error occurred while deleting the profile type' 
    });
  }
});
