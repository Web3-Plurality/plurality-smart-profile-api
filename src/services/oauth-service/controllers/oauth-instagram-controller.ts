import express, { NextFunction, Request, Response } from 'express';
import passport, { DoneCallback } from 'passport';
import * as dotenv from 'dotenv';
import axios from 'axios';
import {
  hasValidAccessTokenHeader,
  hasValidEventHeader,
  hasValidEventParam,
  isProfileMapEmpty,
} from '../middlewares/oauth-middleware';
import Logger from '../../../lib/logger';
import { memoryStoreToken, memoryStoreSSE, memoryStoreProfile } from '../../../utils/global';
import { INSTAGRAM_APP, INTERNAL_SERVER_ERROR, TIMEOUT_ERROR } from '../utils/constants';
import OAuthInstagramStrategy from '../strategies/OAuthInstagramStrategy';
import { InstaProfile } from '../entity/instagram';
import { analyze } from '../utils/groq';
import { createPrompt, INSTA_FETCH_INTEREST_PROMPT } from '../utils/ai-prompts';
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile } from '@plurality-network/smart-profile-utils';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';

dotenv.config();

export const instagramRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done: DoneCallback) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done: DoneCallback) {
  done(null, obj);
});

passport.use(
  'instagram',
  // Strategy initialization
  new OAuthInstagramStrategy(
    {
      authorizationURL: 'https://api.instagram.com/oauth/authorize',
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientID: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      callbackURL: process.env.INSTAGRAM_CALLBACK_URL,
      scope: 'user_profile,user_media',
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: string, refreshToken: string, profile: any, done: DoneCallback) => {
      return done(null, { accessToken, refreshToken, profile });
    },
  ),
);

// Start authentication flow
instagramRouter.get(
  '/',
  hasValidEventParam,
  isProfileMapEmpty,
  async (req: Request, res: Response, next: NextFunction) => {
    // #swagger.tags = ['OAuth']
    // #swagger.ignore = true
    Logger.info(`${INSTAGRAM_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
    passport.authenticate('instagram')(req, res, next);
  },
);

// Callback handler
instagramRouter.get(
  '/callback',
  passport.authenticate('instagram', { session: false }),
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    // #swagger.ignore = true
    try {
      const accessTokenId = uuidv4();
      memoryStoreToken.set(accessTokenId, req?.user?.accessToken);
      const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&app=${INSTAGRAM_APP}`;
      Logger.info(`${INSTAGRAM_APP}: Redirecting to ${url}`);
      res.redirect(url);
    } catch (error: any) {
      Logger.error(`${INSTAGRAM_APP}: Error during callback: ${error.message}`);
      res.status(500).json({ app: INSTAGRAM_APP, message: 'Error during callback' });
    }
  },
);

// Send Event to Iframe
instagramRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  isProfileMapEmpty,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    try {
      Logger.info(`${INSTAGRAM_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${INSTAGRAM_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
      serverSentEventResponse.write(
        `data: {"message":"received", "app":"${INSTAGRAM_APP}", "auth":"${req?.accessTokenID}"}\n\n`,
      );
      Logger.info(`${INSTAGRAM_APP}: Server Side Event has been sent successfully`);
      const connection = memoryStoreSSE.get(req?.sseID);
      connection.end();
      memoryStoreSSE.delete(req?.sseID);
      return res.status(200).json({ app: INSTAGRAM_APP, message: 'success' });
    } catch (error: any) {
      Logger.info(`${INSTAGRAM_APP}:  Error in sending SSE ${error.message}`);
      return res.status(500).json({ app: INSTAGRAM_APP, message: 'Internal Server error' });
    }
  },
);

// Return User Object
instagramRouter.get(
  '/info',
  hasValidAccessTokenHeader,
  isAuthenticated,
  isProfileMapEmpty,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    /* #swagger.security = [{
          "bearerAuth": []
  }] */
    try {
      Logger.info(
        `${INSTAGRAM_APP}: Request for information has been received successfully with id ${req.accessTokenID}`,
      );
      const accessToken = memoryStoreToken.get(req.accessTokenID);
      let instaUser = { data: { data: {} } };
      let instaMedia = { data: { data: [] } };

      if (accessToken) {
        try {
          instaUser = await axios.get(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`, {
            headers: {
              'Content-Type': 'application/json', // eslint-disable-line
            },
            timeout: 20000,
          });
        } catch (error: any) {
          if (error.code === 'ECONNABORTED') {
            Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
          } else {
            Logger.error(`${INSTAGRAM_APP}: An error occurred: ${error.message}`);
          }
        }

        try {
          instaMedia = await axios.get(
            `https://graph.instagram.com/me/media?fields=id,caption&access_token=${accessToken}`,
            {
              headers: {
                'Content-Type': 'application/json', // eslint-disable-line
              },
              timeout: 20000,
            },
          );
        } catch (error: any) {
          if (error.code === 'ECONNABORTED') {
            Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
          } else {
            Logger.error(`${INSTAGRAM_APP}: An error occurred: ${error.message}`);
          }
        }

        const instaProfile = new InstaProfile(instaUser?.data);
        if (instaMedia?.data?.data) {
          const prompt = createPrompt(INSTA_FETCH_INTEREST_PROMPT, instaMedia?.data?.data);
          const interests = await analyze(prompt);
          instaProfile.interests = interests?.Interests || [];
        }
        // Create user profile object
        const smartProfile = new SmartProfile();
        smartProfile.privateData.attestedCred.interests = instaProfile?.interests;
        smartProfile.privateData.attestedPlatformIds.connectedProfiles = [
          { platformType: INSTAGRAM_APP, userPlatformId: instaProfile?.id, username: instaProfile?.username },
        ];
        // storing time to avoid deadlock
        const time = new Date().getTime(); // Current time in milliseconds
        memoryStoreProfile.set(req?.user?.uniqueSessionId, { smartProfile, time });
        memoryStoreToken.delete(req?.accessTokenID);
        Logger.info(`${INSTAGRAM_APP}: Session destroyed successfully`);
        Logger.info(`${INSTAGRAM_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: INSTAGRAM_APP, message: 'success' });
      } else {
        Logger.error(`${INSTAGRAM_APP}: A profile already exists`);
        return res.status(500).json({ app: INSTAGRAM_APP, error: 'Unauthorized', message: INTERNAL_SERVER_ERROR });
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        return res.status(408).json({ app: INSTAGRAM_APP, message: TIMEOUT_ERROR });
      } else {
        Logger.error(`${INSTAGRAM_APP}: Error occurred in fetching user informantion: ${error.message}`);
        return res.status(500).json({ app: INSTAGRAM_APP, message: INTERNAL_SERVER_ERROR });
      }
    }
  },
);
