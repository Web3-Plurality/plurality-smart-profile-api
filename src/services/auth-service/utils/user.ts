import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { ClientApp } from '../../crm-service/entity/client-app';
import { ClientAppDev } from '../../crm-service/entity/client-app-dev';
import { UserSession } from '../entity/user-session';

const userSessionRepository = AppDataSource.getRepository(UserSession);
const clientAppRepository = AppDataSource.getRepository(ClientAppDev);

export const AddUserSession = async (userId: string, clientAppId: string) => {
  try {
    // Check if the client exists
    const existingClientApp = await clientAppRepository.findOne({ where: { id: clientAppId } });
    if (!existingClientApp) {
      Logger.error(`Client with id ${clientAppId} not found`);
      throw new Error('Client not found');
    }
    // Create a new mapping
    const newUserSession = userSessionRepository.create({ userId, clientAppId });
    await userSessionRepository.save(newUserSession);
    Logger.info(`UserSession created: ${newUserSession.id}`);
    return newUserSession.id;
  } catch (error: any) {
    Logger.error(`Error in AddUserSession: ${error.message || JSON.stringify(error)}`);
    throw error;
  }
};
