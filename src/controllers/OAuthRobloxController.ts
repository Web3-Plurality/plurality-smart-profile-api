import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INTERNAL_SERVER_ERROR, ROBLOX_APP, TIMEOUT_ERROR, activeConnections, createPrompt } from "../utils/global";
import OAuthRobloxStrategy from "../auth/OAuthRobloxStrategy";
import { RobloxProfile } from "../entity/Roblox";
import { analyze } from "../utils/groq";
import { calculateReputation, scrapRoblox } from "../utils/roblox";
import { ROBLOX_FETCH_INTEREST_PROMPT } from "../utils/aiPrompts";

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
      scope: "openid profile",// spaces
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
  isConnected,
  async (req: Request, res: Response, next) => {
    Logger.info(`${ROBLOX_APP}: Request for Oauth has been received successfully on session Id${req.sessionID}`)
    req?.session?.redirectParams = {
      isWidget: req?.query?.isWidget,
      origin: req?.query?.origin,
      apps: req?.query?.apps,
    };

    passport.authenticate('roblox')(req, res, next);
  });

// Callback handler
robloxRouter.get('/callback', passport.authenticate('roblox', { session: false }), async (req, res) => {
  try {

    Logger.info(`${ROBLOX_APP}: Callback has been received successfully on session Id${req.sessionID}`);
    let url: any;
    const { isWidget, origin, apps } = req.session.redirectParams;
    const serverSentEventResponse = activeConnections.get(req.sessionID);
    req.session.user = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    }

    if (isWidget == 'true')
      url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=${ROBLOX_APP}`
    else if (isWidget == 'false')
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=${ROBLOX_APP}`
    else {
      Logger.info(`${ROBLOX_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=${ROBLOX_APP}`
    }

    Logger.info(`${ROBLOX_APP}: Redirecting to ${url}`);
    // it will redirect to the dashboard or widget
    res.redirect(url);
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);

    // Send a message to the client that the token has been received
    if (req?.user?.accessToken && serverSentEventResponse) {
      serverSentEventResponse.write(`data: {"message":"received", "app":"${ROBLOX_APP}"}\n\n`)
      Logger.info(`${ROBLOX_APP}: Access token has been received successfully`);
    }
    else {
      Logger.error("An error occurred while accessing session");
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }

  } catch (error: any) {
    Logger.error(`${ROBLOX_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: ROBLOX_APP, message: 'Error during callback' });
  }
});

// Callback handler
robloxRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    Logger.info(`${ROBLOX_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
    const { accessToken }: any = req?.session?.user;
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

        const prompt = createPrompt(ROBLOX_FETCH_INTEREST_PROMPT, userData?.data?.about)
        const interests = await analyze(prompt)
        robloxProfile.interests ??= interests?.Interests
        robloxProfile.introTags ??= interests?.IntroTags
        robloxProfile.idVerified ??= userData?.data?.idVerified
        robloxProfile.premium ??= userData?.data?.premium

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
        robloxProfile.assests ??= inventoryData?.data?.inventoryItems;
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      try {
        const robloxInsights = await scrapRoblox(robloxProfile?.profile);
        robloxProfile.joinDate ??= robloxInsights?.joinDate;
        robloxProfile.placesVisit ??= robloxInsights?.placesVisit;
        robloxProfile.friends ??= robloxInsights?.friends;
        robloxProfile.followers ??= robloxInsights?.followers;
        robloxProfile.following ??= robloxInsights?.following;
        robloxProfile.avtar ??= robloxInsights?.avtar;

      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred while scraping: ${error.message}`);
        }
      }

      robloxProfile.reputationScore += calculateReputation(robloxProfile);

      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          Logger.error(`${ROBLOX_APP}: Error during session destroy: ${err.message}`);
          return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR, error: err });
        }
        Logger.info(`${ROBLOX_APP}: Session destroyed successfully`);
        Logger.info(`${ROBLOX_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: ROBLOX_APP, message: "success", robloxProfile: robloxProfile })
      });
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