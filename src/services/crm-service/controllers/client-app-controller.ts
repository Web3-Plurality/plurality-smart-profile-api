import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { AppType, ClientApp, IncentiveType } from '../entity/client-app';
import { isClientAuthenticated } from '../middlewares/auth-middleware';
import { UserClientMap } from '../../auth-service/entity/user-client-map';
import { User } from '../../user-service/entity/user';
import crypto from "crypto"
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';

export const clientRouter = express.Router();
dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);
const userClientMapRepository = AppDataSource.getRepository(UserClientMap);
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

clientRouter.post('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const { img, streamId, links, domains, incentiveType, appType } = req.body;
    // Upload an image
    let uploadResult;
    if (img) {
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
      appType: appType.toLowerCase() == 'RSM' ? AppType.rsm : AppType.login,
      incentiveType: incentiveType.toLowerCase() == 'STARS' ? IncentiveType.stars : IncentiveType.points,
      clientSecret: hashedSecret
    });
    await clientAppRepository.save(newClientApp);
    Logger.info(`clientApp created: ${newClientApp.id}`);
    return res.status(200).json({
      message: 'clientApp created',
      data: {...newClientApp,clientSecret:clientSecret},
    });
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

clientRouter.put('/:id', async (req: Request, res: Response) => {
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
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

clientRouter.get('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const origin = req.headers['x-domain'];
    const id: any = req.query.uuid;
    const data = await clientAppRepository.findOne({
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
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});


clientRouter.get('/validate', isAuthenticated, isClientAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {

    const userId = req?.user?.id
    const client = req?.client

    const userClientMap = await userClientMapRepository.findOne({
      where: {
          id: userId,
      },
  });
  if (userClientMap?.clientId !== client?.id ) {
    return res.status(401).json({ error: 'user does not belong to the given client' });
  }

  const user = await userRepository?.findOne({
    where: {
      id: userId,
  },
  })

    res.status(200).json({user})
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
