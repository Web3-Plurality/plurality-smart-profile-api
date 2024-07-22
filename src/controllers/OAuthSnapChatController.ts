import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { SNAPCHAT_APP, activeConnections } from "../utils/global";
import OAuthSnapChatStrategy from "../auth/OAuthSnapChatStrategy";
import { SnapChatProfile } from "../entity/Snapchat";

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
  isConnected,
  async (req: Request, res: Response, next) => {
    Logger.info(`${SNAPCHAT_APP}: Request for Oauth has been received successfully on session Id${req.sessionID}`)
    req?.session?.redirectParams = {
      isWidget: req?.query?.isWidget,
      origin: req?.query?.origin,
      apps: req?.query?.apps,
    };
    passport.authenticate('snapchat')(req, res, next);
  });

// Callback handler
snapchatRouter.get('/callback', passport.authenticate('snapchat', { session: false }), async (req, res) => {
  try {

    Logger.info(`${SNAPCHAT_APP}: Callback has been received successfully on session Id${req.sessionID}`);
    let url: any;
    const { isWidget, origin, apps } = req.session.redirectParams;
    const serverSentEventResponse = activeConnections.get(req.sessionID);
    req.session.user = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    }

    if (isWidget == 'true')
      url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    else if (isWidget == 'false')
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    else {
      Logger.info(`${SNAPCHAT_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    }

    Logger.info(`${SNAPCHAT_APP}: Redirecting to ${url}`);
    // it will redirect to the dashboard or widget
    res.redirect(url);
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);

    // Send a message to the client that the token has been received
    if (req?.user?.accessToken && serverSentEventResponse) {
      serverSentEventResponse.write(`data: {"message":"received", "app":"${SNAPCHAT_APP}"}\n\n`)
      Logger.info(`${SNAPCHAT_APP}: Access token of Twitter received successfully`);
    }
    else {
      Logger.error("An error occurred while accessing session");
      return res.status(401).json({ app: SNAPCHAT_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
    }

  } catch (error: any) {
    Logger.error(`${SNAPCHAT_APP}: Error during callback: ${error.message}`);
    res.status(401).json({ app: SNAPCHAT_APP, error: 'Unauthorized', message: 'Error during callback' });
  }
});

// Callback handler
snapchatRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    Logger.info(`${SNAPCHAT_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
    const { accessToken }: any = req?.session?.user;
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
      // Destroy the session data
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          Logger.error(`${SNAPCHAT_APP}: Error during session destroy: ${err.message}`);
          return res.status(500).json({ app: SNAPCHAT_APP, message: "Error during session destroy", error: err });
        }
        Logger.info(`${SNAPCHAT_APP}: Session destroyed successfully`);
        Logger.info(`${SNAPCHAT_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: SNAPCHAT_APP, message: "success", snapchatProfile: snapChatProfile })
      });
    } else {
      Logger.error(`${SNAPCHAT_APP}: Token has been expired.`);
      return res.status(401).json({ app: SNAPCHAT_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${SNAPCHAT_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: SNAPCHAT_APP, error: 'Request Timeout', message: 'Session has expired. Please log in again.' });
    }
    else {
      Logger.error(`${SNAPCHAT_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(401).json({ app: SNAPCHAT_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
    }
  }
});