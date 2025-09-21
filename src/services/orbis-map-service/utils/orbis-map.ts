import { AppDataSource } from '../../../data-source';
import { ProfileTypeOrbis } from '../entity/profile-type';
import Logger from '../../../lib/logger';

const profileTypeRepository = AppDataSource.getRepository(ProfileTypeOrbis);

export const insertProfileType = async (profileName: string, description: string, platformNeeded = []) => {
  // #swagger.tags = ['Profile Type']
  try {
    // Create new profile type
    const newProfileType = profileTypeRepository.create({
      profileName,
      description,
      platforms: JSON.stringify(platformNeeded),
      version: '1.0',
    });

    // Save to database
    const savedProfileType = await profileTypeRepository.save(newProfileType);

    Logger.info(`Profile type created successfully with ID: ${savedProfileType.id}`);

    return savedProfileType;
  } catch (error: any) {
    Logger.error(`Error creating profile type: ${JSON.stringify(error)}`);
  }
};

export async function updateProfileType(id: string, profileName: string, description: string, platformNeeded=[]) {
  try {
    const updateResult = await profileTypeRepository.update(id, {
      profileName,
      description,
      platforms: JSON.stringify(platformNeeded),
      version: '1.0',
    });
    return updateResult;
  } catch (error) {
    console.log(error);
    return error;
  }
}
