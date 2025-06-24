import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { AppType, IncentiveType } from '../entity/client-app';
import { verifyStytchJWT } from '../middlewares/auth-middleware';
import crypto from 'crypto';
import { insertProfileType, updateProfileType } from '../../orbis-map-service/utils/orbis-map';
import { isBase64ImageDataUrl } from '../utils/helper';
import { ClientApp } from '../entity/client-app';
import { UniversalProfile } from '../entity/universal-profile';
import { Platform } from '../entity/platforms';

export const clientAppRouter = express.Router();
dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);
const universalProfileRepository = AppDataSource.getRepository(UniversalProfile);
const platformRepository = AppDataSource.getRepository(Platform);

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
      appName,
      logos = { light: '', dark: '' },
      domains,
      clientId,
      authOptions = {
        email: true,
        gmail: false,
        metamask: false,
      },
      onboardingConfig = null,
      showRoulette = true,
      platformNeeded = [],
      streamId,
    } = req.body;

    // Create authentication object
    const authentication = {
      email: authOptions?.email,
      gmail: authOptions?.gmail,
      wallet: authOptions?.metamask,
    };

    const incentiveType = IncentiveType.points;
    const appType = AppType.login;
    const links: any = [];
    let newStreamId = '';

    // if universal profile is selected, then we need to get the stream id from the universal profile
    if (streamId) {
      const universalProfile = await universalProfileRepository.findOne({
        where: {
          streamId: streamId,
        },
      });
      if (!universalProfile) {
        Logger.error(`Profile type stream id not found: ${streamId}`);
        return res.status(400).json({ error: 'Profile type stream id not found' });
      }
      newStreamId = universalProfile?.streamId;
      Logger.info(`Profile type stream id found: ${streamId}`);
    } else {
      // if universal profile is not selected, then we need to create a new profile
      if (!profileDescription || !profileName) {
        Logger.error(`Profile name or description not found`);
        return res.status(400).json({ error: 'Profile name or description not found' });
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
        newStreamId = result?.id || '';
        Logger.info(`Profile type stream id created: ${newStreamId}`);
      } else {
        // if showRoulette is false, then we need to create a new profile without platform connection
        const result = await insertProfileType(profileName, profileDescription, '');
        newStreamId = result?.id || '';
        Logger.info(`Profile type stream id created: ${newStreamId}`);
      }
    }

    // Upload an image
    const uploadResult = { light: '', dark: '' };
    if (logos?.light) {
      const lightUploadResult = await cloudinary.uploader.upload(logos?.light).catch((error) => {
        console.log(error);
      });
      uploadResult.light = lightUploadResult?.secure_url || '';
    }
    if (logos?.dark) {
      const darkUploadResult = await cloudinary.uploader.upload(logos?.dark).catch((error) => {
        console.log(error);
      });
      uploadResult.dark = darkUploadResult?.secure_url || '';
    }

    // Generate credentials
    const clientAppSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientAppSecret).digest('hex');
    if (newStreamId) {
      // Insert into clientApp
      const newClientApp = clientAppRepository.create({
        appName: appName,
        streamId: newStreamId,
        logos: uploadResult,
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
    } else {
      Logger.error(`Something went wrong with the orbis stream id creation`);
      return res.status(500).json({
        message: 'Something went wrong with the orbis stream id creation',
      });
    }
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
    const {
      profileName,
      profileDescription,
      streamId,
      appName,
      logos = { light: '', dark: '' },
      domains,
      authOptions = {
        email: true,
        gmail: false,
        metamask: false,
      },
      onboardingConfig = null,
      showRoulette = true,
      platformNeeded = [],
    } = req.body;
    const clientAppid = req.params.id;
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
    // check if universal profile is selected
    const universalProfile = await universalProfileRepository.findOne({
      where: {
        streamId: streamId,
      },
    });

    if (!universalProfile?.streamId) {
      // custom profile work flow
      try {
        if (!profileDescription || !profileName) {
          Logger.error(`Profile name or description not found`);
          return res.status(400).json({ error: 'Profile name or description not found' });
        }

        if (showRoulette && !platformNeeded?.length) {
          Logger.error(`Platform needed not found`);
          return res.status(400).json({ error: 'Platform needed not found' });
        }
        const platforms = platformNeeded.map((platform: string) => {
          return { platform, authentication: true };
        });
        // update in orbis
        await updateProfileType(streamId, profileName, profileDescription, JSON.stringify(platforms));
      } catch (error) {
        Logger.error(`Error updating profile type: ${JSON.stringify(error)}`);
        return res.status(400).json({ error: 'Profile type stream id not found' });
      }
    }

    // Upload an image
    const uploadResult = { light: '', dark: '' };
    if (isBase64ImageDataUrl(logos?.light)) {
      const lightUploadResult = await cloudinary.uploader.upload(logos?.light).catch((error) => {
        console.log(error);
      });
      uploadResult.light = lightUploadResult?.secure_url || '';
    } else {
      uploadResult.light = logos?.light;
    }
    if (isBase64ImageDataUrl(logos?.dark)) {
      const darkUploadResult = await cloudinary.uploader.upload(logos?.dark).catch((error) => {
        console.log(error);
      });
      uploadResult.dark = darkUploadResult?.secure_url || '';
    } else {
      uploadResult.dark = logos?.dark;
    }
    // Generate credentials
    const clientAppSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = crypto.createHash('sha256').update(clientAppSecret).digest('hex');
    // Create authentication object
    const authentication = {
      email: authOptions?.email,
      gmail: authOptions?.gmail,
      wallet: authOptions?.metamask,
    };
    // update into clientApp
    const updateData = {
      appName: appName,
      streamId: streamId,
      logos: uploadResult,
      domains: JSON.stringify(domains),
      clientAppSecret: hashedSecret,
      authentication: authentication,
      onboardingConfig: onboardingConfig,
      showRoulette: showRoulette,
    };
    const updatedClientApp = await clientAppRepository.update({ id: clientAppid }, updateData);
    Logger.info(`clientApp updated: ${clientAppid}`);
    return res.status(200).json({
      message: 'clientApp updated',
      data: {
        clientAppId: clientAppid,
        clientAppSecret: clientAppSecret,
      },
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// clientAppRouter.post('/platforms', async (req: Request, res: Response) => {
//   // #swagger.tags = ['Client App']
//   try {
//     const { name, isEnabled } = req.body;
//     const platform = platformRepository.create({ name, isEnabled });
//     await platformRepository.save(platform);
//     return res.status(200).json({
//       success: true,
//       message: 'Platform created successfully',
//     });
//   } catch (error: any) {
//     Logger.error(`Error fetching platforms: ${JSON.stringify(error)}`);
//     return res.status(500).json({
//       success: false,
//       error: 'An error occurred while fetching platforms',
//     });
//   }
// });

clientAppRouter.get('/platforms', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const platforms = await platformRepository.find({
      select: { name: true },
      order: {
        name: 'ASC',
      },
      where: {
        isEnabled: true,
      },
    });

    const pl = platforms.map((platform) => {
      return platform.name;
    });

    return res.status(200).json({
      success: true,
      data: { platforms: pl },
    });
  } catch (error: any) {
    Logger.error(`Error fetching platforms: ${JSON.stringify(error)}`);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while fetching platforms',
    });
  }
});

clientAppRouter.get('/universal-profile', async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const universalProfiles = await universalProfileRepository.find({
      order: {
        name: 'ASC',
      },
      select: {
        name: true,
        streamId: true,
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
      // for only light theme for now
      const { clientAppSecret, ...rest } = data;
      const clientApp = {
        ...rest,
        logo: data?.logos?.light || data?.logos?.dark,
      };
      return res.status(200).json({ data: clientApp });
    }

    Logger.error(`Invalid domain: ${origin}`);
    return res.status(400).json({ error: 'Invalid domain' });
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
