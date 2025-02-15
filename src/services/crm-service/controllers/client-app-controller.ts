import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { AppType, IncentiveType } from '../entity/client-app';
import { verifyStytchJWT } from '../middlewares/auth-middleware';
import crypto from 'crypto';
import { connectOrbisDidPkh, initializeOrbis, insertProfileType, updateProfileType } from '../utils/orbis';
import { Client } from '../entity/client';
import { ClientApp } from '../entity/client-app';
import { isBase64ImageDataUrl } from '../utils/helper';

export const clientAppRouter = express.Router();
dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);

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

    const incentiveType = IncentiveType.points;
    const appType = AppType.login;
    const links: any = [];
    const streamId = result?.id;
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

clientAppRouter.put('/:id', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const { streamId, img, domains, profileName, profileDescription } = req.body;
    const clientAppid = req.params.id;

    // Orbis
    await initializeOrbis();
    const isConnected = await connectOrbisDidPkh();
    if (!isConnected) {
      Logger.error('Something went wrong with the orbis');
      res.status(500).send('Internal Server Error');
    }

    // update in orbis
    await updateProfileType(streamId, profileName, profileDescription);

    // Upload an image
    let uploadResult;
    if (img && isBase64ImageDataUrl(img)) {
      uploadResult = await cloudinary.uploader.upload(img).catch((error) => {
        console.log(error);
      });
    }

    // check customer exist already
    const clientApp = await clientAppRepository.findOne({
      where: {
        id: clientAppid,
      },
    });

    if (!clientApp) {
      return res.status(404).json({
        message: `clientApp of id ${clientAppid} does not exist`,
      });
    }

    // updated data
    const updateData = {
      logo: uploadResult?.secure_url ? uploadResult?.secure_url : clientApp?.logo,
      domains: JSON.stringify(domains),
    };
    await clientAppRepository.update({ id: clientAppid }, updateData);
    Logger.info(`clientApp updated: ${clientAppid}`);
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

clientAppRouter.get('/:id', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const origin = req.headers['x-domain'];
    // remove query and change it to param id
    const clientAppId: any = req.params.id;
    const data: any = await clientAppRepository.findOne({
      where: {
        id: clientAppId,
      },
    });

    const domains = JSON.parse(data?.domains);

    if (domains?.includes(origin)) {
      Logger.info(`clientApp fetched: ${clientAppId}`);
      return res.status(200).json({ data });
    }

    Logger.error(`Invalid domain: ${origin}`);
    return res.status(400).json({ error: 'Invalid domain' });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
