import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { ClientApp } from '../entity/client-app';
import { UserClientMap } from '../entity/user-client-map';

const userClientMapRepository = AppDataSource.getRepository(UserClientMap);
const clientAppRepository = AppDataSource.getRepository(ClientApp);

export const AddUserClientMap = async (userId: string, clientId: string) => {
  try {
    // Check if the client exists
    const existingClient = await clientAppRepository.findOne({ where: { id: clientId } });
    if (!existingClient) {
      Logger.error(`Client with id ${clientId} not found`);
      throw new Error('Client not found');
    }

    // Create a new mapping
    const newUserClientMap = userClientMapRepository.create({ userId, clientId });
    await userClientMapRepository.save(newUserClientMap);
    Logger.info(`UserClientMap created: ${newUserClientMap.id}`);
  } catch (error) {
    Logger.error(`Error in AddUserClientMap: ${error.message || JSON.stringify(error)}`);
    throw error;
  }
};
