import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { hasValidAccessTokenHeader, hasValidEventHeader, hasValidEventParam } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INTERNAL_SERVER_ERROR, SNAPCHAT_APP, TIMEOUT_ERROR, memoryStore } from "../utils/global";
import OAuthSnapChatStrategy from "../auth/OAuthSnapChatStrategy";
import { SnapChatProfile } from "../entity/Snapchat";
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

export const snapchatRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use(
  "snapchat",
  // Strategy initialization
  new OAuthSnapChatStrategy(
    {
      authorizationURL: 'https://accounts.snapchat.com/accounts/oauth2/auth',
      tokenURL: 'https://accounts.snapchat.com/accounts/oauth2/token',
      clientID: process.env.SNAPCHAT_CLIENT_ID,
      clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
      callbackURL: process.env.SNAPCHAT_CALLBACK_URL,
      scope: "https://auth.snapchat.com/oauth2/api/user.display_name https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar https://auth.snapchat.com/oauth2/api/user.external_id", //space
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
snapchatRouter.get(
  '/',
  hasValidEventParam,
  async (req: Request, res: Response, next) => {
    Logger.info(`${SNAPCHAT_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`)
    passport.authenticate('snapchat')(req, res, next);
  });

// Callback handler
snapchatRouter.get('/callback', passport.authenticate('snapchat', { session: false }), async (req, res) => {
  try {
    const accessTokenId = uuidv4();
    memoryStore.set(accessTokenId, req.user.accessToken);
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}`;
    Logger.info(`${SNAPCHAT_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${SNAPCHAT_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: SNAPCHAT_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
snapchatRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  async (req: Request, res: Response) => {
    try {
      Logger.info(`${SNAPCHAT_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${SNAPCHAT_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStore.get(req?.sseID);
      serverSentEventResponse.write(`data: {"message":"received", "app":"${SNAPCHAT_APP}", "auth":"${req?.accessTokenID}"}\n\n`)
      Logger.info(`${SNAPCHAT_APP}: Server Side Event has been sent successfully`);
      memoryStore.delete(req?.sseID);
      return res.status(200).json({ app: SNAPCHAT_APP, message: "success" });
    } catch (error) {
      Logger.info(`${SNAPCHAT_APP}: Error in sending event ${error.message}`);
      return res.status(500).json({ app: SNAPCHAT_APP, message: "Internal Server error" });
    }

  });

// Return User Object
snapchatRouter.get('/info', hasValidAccessTokenHeader, async (req, res) => {
  try {
    Logger.info(`${SNAPCHAT_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStore.get(req.accessTokenID)
    let snapUser = { data: { data: {} } }

    if (accessToken) {

      try {
        snapUser = await axios.post(
          "https://kit.snapchat.com/v1/me",
          { "query": "{me{displayName bitmoji{avatar} externalId}}" },
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
          Logger.error(`${SNAPCHAT_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${SNAPCHAT_APP}: An error occurred: ${error.message}`);
        }
      }
      const snapChatProfile = new SnapChatProfile(snapUser?.data?.data);
      
      memoryStore.delete(req?.accessTokenID);
      Logger.info(`${SNAPCHAT_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: SNAPCHAT_APP, message: "success", snapchatProfile: snapChatProfile })

    } else {
      Logger.error(`${SNAPCHAT_APP}: Token has been expired.`);
      return res.status(500).json({ app: SNAPCHAT_APP, message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${SNAPCHAT_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: SNAPCHAT_APP, message: TIMEOUT_ERROR });
    }
    else {
      Logger.error(`${SNAPCHAT_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: SNAPCHAT_APP, message: INTERNAL_SERVER_ERROR });
    }
  }
});