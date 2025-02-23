import express, { Request, Response } from 'express';
import { isClientAppAuthenticated, isValidUserJwt } from '../middlewares/auth-middleware';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import { UserSession } from '../../auth-service/entity/user-session';

const userRepository = AppDataSource.getRepository(User);
const userSessionRepository = AppDataSource.getRepository(UserSession);
export const userRouter = express.Router();

// endpoint for the client to validate the user session by providing clientAppId, clientAppSercret and user token
userRouter.post('/validate', isValidUserJwt, isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Users']
  /* #swagger.security = [{
        "basicAuth": []
    }] */
  try {
    const clientApp = req?.clientApp;
    const userClientAppMap = await userSessionRepository.findOne({
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

    res.status(200).json({
      success: true,
      user: { id: user?.id, email: user?.email, authAddress: user?.authAddress, proxyAddress: user?.pkpAddress },
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
