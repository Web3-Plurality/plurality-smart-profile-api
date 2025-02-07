import express, { Request, Response } from 'express';
import { isClientAppAuthenticated, isUserAuthenticated } from '../middlewares/auth-middleware';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import { UserClientAppMap } from '../../auth-service/entity/user-client-app-map';

const userRepository = AppDataSource.getRepository(User);
const userClientAppMapRepository = AppDataSource.getRepository(UserClientAppMap);
export const userRouter = express.Router();

// endpoint for the client to validate the user session by providing clientAppId, clientAppSercret and user token
userRouter.get('/validate',isUserAuthenticated, isClientAppAuthenticated, async (req: Request, res: Response) => {
    // #swagger.tags = ['Client App']
    try {
        const clientApp = req?.clientApp;
        const userClientAppMap = await userClientAppMapRepository.findOne({
            where: {
                id: req?.user?.uniqueSessionId,
            },
        });
        if (userClientAppMap?.clientAppId !== clientApp?.id) {
            return res.status(401).json({ error: 'user does not belong to the given client' });
        }

        const user = await userRepository?.findOne({
            where: {
                id: req?.user?.id,
            },
        });

        res.status(200).json({ user });
    } catch (error: any) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
});
