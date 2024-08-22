import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { hasValidAccessTokenHeader, hasValidEventHeader, hasValidEventParam } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INTERNAL_SERVER_ERROR, ROBLOX_APP, TIMEOUT_ERROR, memoryStore, createPrompt } from "../utils/global";
import OAuthRobloxStrategy from "../auth/OAuthRobloxStrategy";
import { RobloxProfile } from "../entity/Roblox";
import { analyze } from "../utils/groq";
import { calculateReputation, scrapRoblox } from "../utils/roblox";
import { ROBLOX_FETCH_INTEREST_PROMPT } from "../utils/aiPrompts";
import { v4 as uuidv4 } from 'uuid';
import { UserProfile } from "../entity/UserProfile";


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
  "roblox",
  // Strategy initialization
  new OAuthRobloxStrategy(
    {
      authorizationURL: 'https://apis.roblox.com/oauth/v1/authorize',
      tokenURL: 'https://apis.roblox.com/oauth/v1/token',
      clientID: process.env.ROBLOX_CLIENT_ID,
      clientSecret: process.env.ROBLOX_CLIENT_SECRET,
      callbackURL: process.env.ROBLOX_CALLBACK_URL,
      scope: "openid profile asset:read",// spaces
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      return done(null, { accessToken, refreshToken, profile });
    }
  )
);

// Start authentication flow
robloxRouter.get(
  '/',
  hasValidEventParam,
  async (req: Request, res: Response, next) => {
    Logger.info(`${ROBLOX_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`)
    passport.authenticate('roblox')(req, res, next);
  });

// Callback handler
robloxRouter.get('/callback', passport.authenticate('roblox', { session: false }), async (req, res) => {
  try {
    const accessTokenId = uuidv4();
    memoryStore.set(accessTokenId, req.user.accessToken);
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
  async (req: Request, res: Response) => {
    try {
      Logger.info(`${ROBLOX_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${ROBLOX_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStore.get(req?.sseID);
      serverSentEventResponse.write(`data: {"message":"received", "app":"${ROBLOX_APP}", "auth":"${req?.accessTokenID}"}\n\n`)
      Logger.info(`${ROBLOX_APP}: Server Side Event has been sent successfully`);
      memoryStore.delete(req?.sseID);
      return res.status(200).json({ app: ROBLOX_APP, message: "success" });
    } catch (error) {
      Logger.info(`${ROBLOX_APP}: Error in sending SSE ${error.message}`);
      return res.status(500).json({ app: ROBLOX_APP, message: "Internal Server error" });
    }

  });

// Return User Object
robloxRouter.get('/info', hasValidAccessTokenHeader, async (req, res) => {
  try {
    Logger.info(`${ROBLOX_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStore.get(req.accessTokenID)
    let userRoblox = { data: {} }
    let inventoryData = []

    if (accessToken) {
      try {
        userRoblox = await axios.get(
          `https://apis.roblox.com/oauth/v1/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      const robloxProfile = new RobloxProfile(userRoblox?.data);

      try {
        const userData = await axios.get(
          `https://apis.roblox.com/cloud/v2/users/${userRoblox?.data?.sub}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );

        const prompt = createPrompt(ROBLOX_FETCH_INTEREST_PROMPT, userData?.data?.about);
        const interests = await analyze(prompt);
        robloxProfile.interests = interests?.Interests || [];
        robloxProfile.introTags = interests?.IntroTags || [];
        robloxProfile.idVerified = userData?.data?.idVerified;
        robloxProfile.premium = userData?.data?.premium;

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
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
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
        robloxProfile.avatar = robloxInsights?.avtar;

      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred while scraping: ${error.message}`);
        }
      }

      robloxProfile.reputationScore += calculateReputation(robloxProfile);

      // Create user profile object
      const userProfile = new UserProfile();
      userProfile.username = robloxProfile?.name;
      userProfile.interests = robloxProfile?.interests;
      userProfile.avatar = robloxProfile?.avatar;
      userProfile.scores.push({ score_type: "reputation score", score_value: robloxProfile?.reputationScore });
      userProfile.reputation_tags = robloxProfile?.introTags;
      userProfile.collections = robloxProfile?.assests;
      userProfile.extra.push({ field: "places visit", value: robloxProfile?.placesVisit });
      userProfile.extra.push({ field: "friends", value: robloxProfile?.friends });
      userProfile.extra.push({ field: "followers", value: robloxProfile?.followers });
      userProfile.extra.push({ field: "following", value: robloxProfile?.following });

      memoryStore.delete(req?.accessTokenID);
      Logger.info(`${ROBLOX_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: ROBLOX_APP, message: "success", robloxProfile: robloxProfile })
    } else {
      Logger.error(`${ROBLOX_APP}: Token has been expired.`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: ROBLOX_APP, message: TIMEOUT_ERROR });
    }
    else {
      Logger.error(`${ROBLOX_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  }
});