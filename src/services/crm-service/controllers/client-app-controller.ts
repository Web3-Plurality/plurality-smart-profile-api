import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { AppType, IncentiveType } from '../entity/client-app-dev';
import { verifyStytchJWT } from '../middlewares/auth-middleware';
import crypto from 'crypto';
import { connectOrbisDidPkh, initializeOrbis, insertProfileType, updateProfileType } from '../utils/orbis';
import { ClientApp } from '../entity/client-app';
import { isBase64ImageDataUrl } from '../utils/helper';
import { ClientAppDev } from '../entity/client-app-dev';
import { UniversalProfile, UniversalProfileType } from '../entity/universal-profile';

export const clientAppRouter = express.Router();
dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientAppDev);
const universalProfileRepository = AppDataSource.getRepository(UniversalProfile);

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

clientAppRouter.post('/', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  try {
    const {
      profileName,
      profileDescription,
      isUniversalProfileSelected,
      universalProfileName,
      logo,
      domains,
      clientId,
      emailAuth = false,
      gmailAuth = false,
      walletAuth = false,
      onboardingConfig = null,
      showRoulette = false,
      platformNeeded = [], // [{platform: 'Twitter', authentication: true}]
    } = req.body;

    // Create authentication object
    const authentication = {
      email: emailAuth,
      gmail: gmailAuth,
      wallet: walletAuth,
    };

    const incentiveType = IncentiveType.points;
    const appType = AppType.login;
    const links: any = [];
    let streamId = '';

    // if universal profile is selected, then we need to get the stream id from the universal profile
    if (isUniversalProfileSelected) {
      const universalProfile = await universalProfileRepository.findOne({
        where: {
          name: universalProfileName,
        },
      });
      if (!universalProfile?.streamId) {
        Logger.error(`Profile type stream id not found: ${universalProfileName}`);
        return res.status(400).json({ error: 'Profile type stream id not found' });
      }
      streamId = universalProfile?.streamId;
      Logger.info(`Profile type stream id found: ${streamId}`);
    } else {
      // if universal profile is not selected, then we need to create a new profile
      if (!profileDescription || !profileName) {
        Logger.error(`Profile name or description not found`);
        return res.status(400).json({ error: 'Profile name or description not found' });
      }
      // Orbis
      await initializeOrbis();
      const isConnected = await connectOrbisDidPkh();
      if (!isConnected) {
        Logger.error('Something went wrong with the orbis');
        res.status(500).send('Internal Server Error');
      }

      // if showRoulette is true and platformNeeded is not found, then we need to return an error
      if (showRoulette && !platformNeeded?.length) {
        Logger.error(`Platform needed not found`);
        return res.status(400).json({ error: 'Platform needed not found' });
      } else if (showRoulette && platformNeeded?.length) {
        // if showRoulette is true and platformNeeded is found, then we need to create a new profile

        const platforms = platformNeeded.map((platform: string) => {
          return { platform, authentication: true };
        });
        const result = await insertProfileType(profileName, profileDescription, JSON.stringify(platforms));
        streamId = result?.id || '';
        Logger.info(`Profile type stream id created: ${streamId}`);
      } else {
        // if showRoulette is false, then we need to create a new profile without platform connection
        const result = await insertProfileType(profileName, profileDescription, '');
        streamId = result?.id || '';
        Logger.info(`Profile type stream id created: ${streamId}`);
      }
    }

    // Upload an image
    let uploadResult;
    if (logo) {
      uploadResult = await cloudinary.uploader.upload(logo).catch((error) => {
        console.log(error);
      });
    }

    // Generate credentials
    const clientAppSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientAppSecret).digest('hex');

    // Insert into clientApp
    const newClientApp = clientAppRepository.create({
      streamId: streamId,
      logo: uploadResult?.secure_url,
      links: JSON.stringify(links),
      domains: JSON.stringify(domains),
      appType: appType,
      incentiveType: incentiveType,
      clientAppSecret: hashedSecret,
      client: { id: clientId },
      authentication: authentication,
      onboardingConfig: onboardingConfig,
      showRoulette: showRoulette,
    });
    await clientAppRepository.save(newClientApp);
    Logger.info(`clientApp created: ${newClientApp.id}`);

    return res.status(200).json({
      message: 'clientApp created',
      data: {
        clientAppId: newClientApp?.id,
        clientAppSecret: clientAppSecret,
        customOnboarding: newClientApp.onboardingConfig,
        authentication: newClientApp.authentication,
      },
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

clientAppRouter.put('/:id', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  try {
    const { streamId, logo, domains, profileName, profileDescription } = req.body;
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
    if (logo && isBase64ImageDataUrl(logo)) {
      uploadResult = await cloudinary.uploader.upload(logo).catch((error) => {
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
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
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
    const clientAppSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientAppSecret).digest('hex');
    // updated data
    const updateData = {
      clientAppSecret: hashedSecret,
    };
    await clientAppRepository.update({ id: clientAppId }, updateData);
    Logger.info(`clientApp secret updated: ${clientAppId}`);
    return res.status(200).json({
      success: true,
      message: 'clientApp updated',
      clientAppSecret,
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Move universal-profile route BEFORE the /:id route
clientAppRouter.get('/universal-profile', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const universalProfiles = await universalProfileRepository.find({
      order: {
        name: 'ASC',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        universalProfiles,
      },
    });
  } catch (error: any) {
    Logger.error(`Error fetching profile types: ${JSON.stringify(error)}`);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while fetching profile types',
    });
  }
});

// Move this route AFTER the /universal-profile route
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
