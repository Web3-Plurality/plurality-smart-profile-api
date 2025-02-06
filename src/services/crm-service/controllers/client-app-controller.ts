import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { AppType, ClientApp, IncentiveType } from '../entity/client-app';
import { isClientAppAuthenticated, verifyStytchJWT } from '../middlewares/auth-middleware';
import { User } from '../../user-service/entity/user';
import crypto from 'crypto';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';
import { connectOrbisDidPkh, initializeOrbis, insertProfileType } from '../utils/orbis';
import { ClientAppDev } from '../entity/client-app-dev';
import { UserClientAppMap } from '../../auth-service/entity/user-client-app-map';

export const clientAppRouter = express.Router();
dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientAppDev);
const userClientAppMapRepository = AppDataSource.getRepository(UserClientAppMap);
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

clientAppRouter.post('/', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const { profileName, profileDescription, img, domains, clientId } = req.body;

    // Orbis
    await initializeOrbis();
    const isConnected = await connectOrbisDidPkh();
    if (!isConnected) {
      Logger.error('Something went wrong with the orbis');
      res.status(500).send('Internal Server Error');
    }

    const result = await insertProfileType(profileName, profileDescription);

    const incentiveType = IncentiveType.stars;
    const appType = AppType.login;
    const links: any = [];
    const streamId = result?.id;
    // Upload an image
    let uploadResult;
    if (img) {
      // const buffer = Buffer.from(await img.arrayBuffer()); // Convert Blob/File to Buffer
      // const base64 = `data:image/png;base64,${buffer.toString('base64')}`; // Convert to Base64

      uploadResult = await cloudinary.uploader.upload(img).catch((error) => {
        console.log(error);
      });
    }

    // Generate credentials
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientSecret).digest('hex');

    // Insert into clientApp
    const newClientApp = await clientAppRepository.create({
      streamId: streamId,
      logo: uploadResult?.secure_url,
      links: JSON.stringify(links),
      domains: JSON.stringify(domains),
      appType: appType,
      incentiveType: incentiveType,
      clientSecret: hashedSecret,
      client: { id: clientId },
    });
    await clientAppRepository.save(newClientApp);
    Logger.info(`clientApp created: ${newClientApp.id}`);
    return res.status(200).json({
      message: 'clientApp created',
      data: { clientAppId: newClientApp?.id, clientSecret: clientSecret },
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

clientAppRouter.put('/:id',verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const { img, streamId, links, domains, incentiveType, appType } = req.body;
    const id = req.params.id;

    // Upload an image
    let uploadResult;
    if (img) {
      uploadResult = await cloudinary.uploader.upload(img).catch((error) => {
        console.log(error);
      });
    }
    // check customer exist already
    const data = await clientAppRepository.findOne({
      where: {
        id: id,
      },
    });
    console.log(data);
    // updated data
    const updateData = {
      streamId: streamId ? streamId : data?.streamId,
      logo: uploadResult?.secure_url ? uploadResult?.secure_url : data?.logo,
      links: links ? JSON.stringify(links) : data?.links,
      domains: domains ? JSON.stringify(domains) : data?.domains,
      appType: appType?.toLowerCase()
        ? appType?.toLowerCase() === 'rsm'
          ? AppType.rsm
          : AppType.login
        : data?.appType,
      incentiveType: incentiveType?.toLowerCase()
        ? incentiveType?.toLowerCase() == 'stars'
          ? IncentiveType.stars
          : IncentiveType.points
        : data?.incentiveType,
    };
    await clientAppRepository.update({ id: id }, updateData);
    Logger.info(`clientApp updated: ${id}`);
    return res.status(200).json({
      message: 'clientApp updated',
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

clientAppRouter.put('/rotate-secret/:id', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const clientAppId = req.params.id;
    // check customer exist already
    const clientApp = await clientAppRepository.findOne({
      where: {
        id: clientAppId,
      },
    });

    if (!clientApp) {
      Logger.error('clientApp not found');
      res.status(400).json({ error: 'clientApp does not exist.' });
    }
    // Generate credentials
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientSecret).digest('hex');
    // updated data
    const updateData = {
      clientSecret: hashedSecret,
    };
    await clientAppRepository.update({ id: clientAppId }, updateData);
    Logger.info(`clientApp secret updated: ${clientAppId}`);
    return res.status(200).json({
      success: true,
      message: 'clientApp updated',
      clientSecret,
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

//todo: add new route for client app
//clientAppRouter.get('/' verifyStytchJWT -> need to verify the stytch jwt token and return all apps against the clientId 

// todo: improve this route
// clientAppRouter.get('/:id' -> dont need to verify this route as this is public
clientAppRouter.get('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const origin = req.headers['x-domain'];
    // remove query and change it to param id
    const id: any = req.query.uuid;
    const data: any = await clientAppRepository.findOne({
      where: {
        id: id,
      },
    });

    const domains = JSON.parse(data?.domains);

    if (domains?.includes(origin)) {
      Logger.info(`clientApp fetched: ${id}`);
      return res.status(200).json({ data });
    }

    Logger.error(`Invalid domain: ${origin}`);
    return res.status(400).json({ error: 'Invalid domain' });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// we needed an endpoint for the client to validate the user session by providing clientAppId, clientAppSercret and user token
// we should move it to user service
clientAppRouter.get('/validate', isAuthenticated, isClientAppAuthenticated, async (req: Request, res: Response) => {
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
