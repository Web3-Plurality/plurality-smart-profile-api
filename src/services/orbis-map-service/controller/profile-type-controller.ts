import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import { ProfileTypeOrbis } from '../entity/profile-type';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';

dotenv.config();

export const profileTypeRouter = express.Router();

// Get the ProfileType repository
const profileTypeRepository = AppDataSource.getRepository(ProfileTypeOrbis);

profileTypeRouter.get('/', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const profileTypes = await profileTypeRepository.find({
      order: {
        profileName: 'ASC',
      },
    });

    Logger.info(`Retrieved ${profileTypes.length} profile types`);

    return res.status(200).json({
      success: true,
      data: profileTypes,
      count: profileTypes.length,
    });
  } catch (error: any) {
    Logger.error(`Error retrieving profile types: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving profile types',
    });
  }
});

// GET /profile-types/:id - Get a specific profile type by ID
profileTypeRouter.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Profile Type']
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid ID format. Please provide a valid UUID.',
      });
    }

    const profileType = await profileTypeRepository.findOne({
      where: { id },
    });

    if (!profileType) {
      return res.status(404).json({
        error: 'Profile type not found',
      });
    }

    Logger.info(`Retrieved profile type with ID: ${id}`);

    return res.status(200).json({
      success: true,
      data: profileType,
    });
  } catch (error: any) {
    Logger.error(`Error retrieving profile type: ${JSON.stringify(error)}`);
    return res.status(500).json({
      error: 'An error occurred while retrieving the profile type',
    });
  }
});


