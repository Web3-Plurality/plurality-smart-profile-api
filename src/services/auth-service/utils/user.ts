import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { ClientApp } from '../../crm-service/entity/client-app';
import { ClientAppDev } from '../../crm-service/entity/client-app-dev';
import { UserClientAppMap } from '../entity/user-client-app-map';
import { UserClientMap } from '../entity/user-client-map';

const userClientAppMapRepository = AppDataSource.getRepository(UserClientAppMap);
const clientAppRepository = AppDataSource.getRepository(ClientAppDev);

export const AddUserClientMap = async (userId: string, clientAppId: string) => {
  try {
    // Check if the client exists
    const existingClientApp = await clientAppRepository.findOne({ where: { id: clientAppId } });
    if (!existingClientApp) {
      Logger.error(`Client with id ${clientAppId} not found`);
      throw new Error('Client not found');
    }
    // Create a new mapping
    const newUserClientAppMap = userClientAppMapRepository.create({ userId, clientAppId });
    await userClientAppMapRepository.save(newUserClientAppMap);
    Logger.info(`UserClientAppMap created: ${newUserClientAppMap.id}`);
    return newUserClientAppMap.id;
  } catch (error: any) {
    Logger.error(`Error in AddUserClientAppMap: ${error.message || JSON.stringify(error)}`);
    throw error;
  }
};
