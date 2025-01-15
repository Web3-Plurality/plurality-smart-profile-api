import express, { Request, Response } from 'express';
import passport from 'passport';
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
import { INTERNAL_SERVER_ERROR, ROBLOX_APP, TIMEOUT_ERROR } from '../utils/constants';
import OAuthRobloxStrategy from '../strategies/OAuthRobloxStrategy';
import { RobloxProfile } from '../entity/roblox';
import { analyze } from '../utils/groq';
import { calculateReputation, scrapRoblox } from '../utils/roblox';
import { createPrompt, ROBLOX_FETCH_INTEREST_PROMPT } from '../utils/ai-prompts';
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile, ScoreTypes } from '@plurality-network/smart-profile-utils';
import { isAuthenticated } from '../../user-service/middlewares/auth-middleware';

dotenv.config();

export const robloxRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use(
  'roblox',
  // Strategy initialization
  new OAuthRobloxStrategy(
    {
      authorizationURL: 'https://apis.roblox.com/oauth/v1/authorize',
      tokenURL: 'https://apis.roblox.com/oauth/v1/token',
      clientID: process.env.ROBLOX_CLIENT_ID,
      clientSecret: process.env.ROBLOX_CLIENT_SECRET,
      callbackURL: process.env.ROBLOX_CALLBACK_URL,
      scope: 'openid profile asset:read', // spaces
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      return done(null, { accessToken, refreshToken, profile });
    },
  ),
);

// Start authentication flow
robloxRouter.get('/', hasValidEventParam, isProfileMapEmpty, async (req: Request, res: Response, next) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  Logger.info(`${ROBLOX_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
  passport.authenticate('roblox')(req, res, next);
});

// Callback handler
robloxRouter.get('/callback', passport.authenticate('roblox', { session: false }), async (req, res) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  try {
    const accessTokenId = uuidv4();
    memoryStoreToken.set(accessTokenId, req.user.accessToken);
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&app=${ROBLOX_APP}`;
    Logger.info(`${ROBLOX_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${ROBLOX_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: ROBLOX_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
robloxRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  isProfileMapEmpty,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    try {
      Logger.info(`${ROBLOX_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${ROBLOX_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
      serverSentEventResponse.write(
        `data: {"message":"received", "app":"${ROBLOX_APP}", "auth":"${req?.accessTokenID}"}\n\n`,
      );
      Logger.info(`${ROBLOX_APP}: Server Side Event has been sent successfully`);
      memoryStoreSSE.delete(req?.sseID);
      return res.status(200).json({ app: ROBLOX_APP, message: 'success' });
    } catch (error) {
      Logger.info(`${ROBLOX_APP}: Error in sending SSE ${error.message}`);
      return res.status(500).json({ app: ROBLOX_APP, message: 'Internal Server error' });
    }
  },
);

// Return User Object
robloxRouter.get('/info', hasValidAccessTokenHeader, isAuthenticated, isProfileMapEmpty, async (req, res) => {
  // #swagger.tags = ['OAuth']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  try {
    Logger.info(`${ROBLOX_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStoreToken.get(req.accessTokenID);
    let userRoblox = { data: {} };
    let inventoryData = [];

    if (accessToken) {
      try {
        userRoblox = await axios.get(`https://apis.roblox.com/oauth/v1/userinfo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`, // eslint-disable-line
            'Content-Type': 'application/json', // eslint-disable-line
          },
          timeout: 20000,
        });
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      const robloxProfile = new RobloxProfile(userRoblox?.data);

      try {
        const userData = await axios.get(`https://apis.roblox.com/cloud/v2/users/${userRoblox?.data?.sub}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`, // eslint-disable-line
            'Content-Type': 'application/json', // eslint-disable-line
          },
          timeout: 20000,
        });

        if (userData?.data?.about) {
          const prompt = createPrompt(ROBLOX_FETCH_INTEREST_PROMPT, userData?.data?.about);
          const interests = await analyze(prompt);
          robloxProfile.interests = interests?.Interests || [];
          robloxProfile.introTags = interests?.IntroTags || [];
          robloxProfile.idVerified = userData?.data?.idVerified;
          robloxProfile.premium = userData?.data?.premium;
          robloxProfile.about = userData?.data?.about;
        }
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      try {
        inventoryData = await axios.get(
          `https://apis.roblox.com/cloud/v2/users/${userRoblox?.data?.sub}/inventory-items`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`, // eslint-disable-line
              'Content-Type': 'application/json', // eslint-disable-line
            },
            timeout: 20000,
          },
        );
        robloxProfile.assests = inventoryData?.data?.inventoryItems;
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      // try {
      //   console.log("asset Id")
      //   console.log(robloxProfile.assests[0]?.assetDetails?.assetId)
      //   const asset = await axios.get(
      //     `https://apis.roblox.com/assets/v1/assets/${robloxProfile.assests[0]?.assetDetails?.assetId}`,
      //     {
      //       headers: {
      //         Authorization: `Bearer ${accessToken}`,
      //         "Content-Type": "application/json",
      //       },
      //       timeout: 20000,
      //     }
      //   );
      //   console.log("aaaaaaaaaa")
      //   console.log(asset?.data)
      // } catch (error) {
      //   if (error.code === 'ECONNABORTED') {
      //     Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      //   } else {
      //     Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
      //   }
      // }

      try {
        const robloxInsights = await scrapRoblox(robloxProfile?.profile);
        robloxProfile.joinDate = robloxInsights?.joinDate;
        robloxProfile.placesVisit = robloxInsights?.placesVisit;
        robloxProfile.friends = robloxInsights?.friends;
        robloxProfile.followers = robloxInsights?.followers;
        robloxProfile.following = robloxInsights?.following;
        robloxProfile.avatar = robloxInsights?.avatar;
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred while scraping: ${error.message}`);
        }
      }

      robloxProfile.reputationScore += calculateReputation(robloxProfile);
      // Create user profile object
      const smartProfile = new SmartProfile();
      smartProfile.privateData.attestedCred.interests = robloxProfile?.interests;
      smartProfile.scores.push({
        scoreType: ScoreTypes.reputationScore,
        scoreValue: robloxProfile?.reputationScore,
      });
      smartProfile.privateData.attestedCred.reputationTags = robloxProfile?.introTags;
      smartProfile.privateData.attestedCred.collections = robloxProfile?.assests;
      const counts = {
        placesVisit: robloxProfile?.placesVisit,
        friends: robloxProfile?.friends,
        followers: robloxProfile?.followers,
        following: robloxProfile?.following,
      };
      smartProfile.privateData.extendedPrivateData[ROBLOX_APP] = counts;
      smartProfile.privateData.attestedPlatformIds.connectedProfiles = [
        { platformType: ROBLOX_APP, userPlatformId: '', username: robloxProfile?.name },
      ];
      // storing time to avoid deadlock
      const time = new Date().getTime(); // Current time in milliseconds
      memoryStoreProfile.set(req?.user?.uniqueSessionId, { smartProfile, time });
      memoryStoreToken.delete(req?.accessTokenID);
      Logger.info(`${ROBLOX_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: ROBLOX_APP, message: 'success' });
    } else {
      Logger.error(`${ROBLOX_APP}: Token has been expired.`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: ROBLOX_APP, message: TIMEOUT_ERROR });
    } else {
      Logger.error(`${ROBLOX_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  }
});
