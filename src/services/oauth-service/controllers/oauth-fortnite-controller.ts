import express, { Request, Response } from 'express';
import passport from 'passport';
import * as dotenv from 'dotenv';
import axios from 'axios';
import {
  hasValidAccessTokenHeader,
  hasValidEventHeader,
  hasValidEventParam,
  isAuthenticated,
  isProfileMapEmpty,
} from '../middlewares/oauth-middleware';
import Logger from '../../../lib/logger';
import { memoryStoreToken, memoryStoreSSE, memoryStoreProfile } from '../../../utils/global';
import { FORTNITE_APP, INTERNAL_SERVER_ERROR, TIMEOUT_ERROR } from '../utils/constants';
import OAuthFortniteStrategy from '../strategies/OAuthFortniteStrategy';
import jwt from 'jsonwebtoken';
import { FortniteProfile } from '../entity/fortnite';
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile } from '@plurality-network/smart-profile-utils';

dotenv.config();

export const fortniteRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use(
  'fortnite',
  // Strategy initialization
  new OAuthFortniteStrategy(
    {
      authorizationURL: 'https://www.epicgames.com/id/authorize',
      tokenURL: 'https://api.epicgames.dev/epic/oauth/v1/token',
      clientID: process.env.FORTNITE_CLIENT_ID,
      clientSecret: process.env.FORTNITE_CLIENT_SECRET,
      callbackURL: process.env.FORTNITE_CALLBACK_URL,
      scope: 'basic_profile', // spaces
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      return done(null, { accessToken, refreshToken, accountId: jwt.decode(accessToken)?.sub });
    },
  ),
);

// Start authentication flow
fortniteRouter.get('/', hasValidEventParam, isProfileMapEmpty, async (req: Request, res: Response, next) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  Logger.info(`${FORTNITE_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
  passport.authenticate('fortnite')(req, res, next);
});

// Callback handler
fortniteRouter.get('/callback', passport.authenticate('fortnite', { session: false }), async (req, res) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  try {
    const accessTokenId = uuidv4();
    memoryStoreToken.set(accessTokenId, {
      accessToken: req.user.accessToken,
      accountId: req.user.accountId,
    });
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&app=${FORTNITE_APP}`;
    Logger.info(`${FORTNITE_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${FORTNITE_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: FORTNITE_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
fortniteRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  isProfileMapEmpty,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    try {
      Logger.info(`${FORTNITE_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${FORTNITE_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
      serverSentEventResponse.write(
        `data: {"message":"received", "app":"${FORTNITE_APP}", "auth":"${req?.accessTokenID}"}\n\n`,
      );
      Logger.info(`${FORTNITE_APP}: Server Side Event has been sent successfully`);
      memoryStoreSSE.delete(req?.sseID);
      return res.status(200).json({ app: FORTNITE_APP, message: 'success' });
    } catch (error) {
      Logger.info(`${FORTNITE_APP}: Error in sending SSE ${error.message}`);
      return res.status(500).json({ app: FORTNITE_APP, message: 'Internal Server error' });
    }
  },
);

// Return User Object
fortniteRouter.get('/info', hasValidAccessTokenHeader, isAuthenticated, isProfileMapEmpty,
   async (req, res) => {
  // #swagger.tags = ['OAuth']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  try {
    Logger.info(`${FORTNITE_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const { accessToken, accountId }: any = memoryStoreToken.get(req.accessTokenID);
    let userFortnite = { data: {} };

    if (accessToken) {
      try {
        userFortnite = await axios.get(`https://api.epicgames.dev/epic/id/v2/accounts?accountId=${accountId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`, // eslint-disable-line
            'Content-Type': 'application/json', // eslint-disable-line
          },
          timeout: 20000,
        });
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${FORTNITE_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${FORTNITE_APP}: An error occurred: ${error.message}`);
        }
      }

      const fortniteProfile = new FortniteProfile(userFortnite?.data[0]);

      // Create user profile object
      const smartProfile = new SmartProfile();
      smartProfile.privateData.attestedPlatformIds.connectedProfiles = [
        {
          platformType: FORTNITE_APP,
          userPlatformId: fortniteProfile?.accountId,
          username: fortniteProfile?.displayName,
        },
      ];
      // storing time to avoid deadlock
      const time = new Date().getTime(); // Current time in milliseconds
      memoryStoreProfile.set(req?.user?.uniqueSessionId, {smartProfile, time});
      memoryStoreToken.delete(req?.accessTokenID);
      Logger.info(`${FORTNITE_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: FORTNITE_APP, message: 'success' });
    } else {
      Logger.error(`${FORTNITE_APP}: Token has been expired.`);
      return res.status(500).json({ app: FORTNITE_APP, error: 'Unauthorized', message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${FORTNITE_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: FORTNITE_APP, message: TIMEOUT_ERROR });
    } else {
      Logger.error(`${FORTNITE_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: FORTNITE_APP, error: 'Unauthorized', message: INTERNAL_SERVER_ERROR });
    }
  }
});
