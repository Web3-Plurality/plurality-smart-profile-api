import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { activeConnections, FORTNITE_APP } from "../utils/global";
import OAuthFortniteStrategy from "../auth/OAuthFortniteStrategy"
import  jwt  from 'jsonwebtoken'
import { FortniteProfile } from "../entity/Fortnite";
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
  "fortnite",
  // Strategy initialization
  new OAuthFortniteStrategy(
    {
      authorizationURL: 'https://www.epicgames.com/id/authorize',
      tokenURL: 'https://api.epicgames.dev/epic/oauth/v1/token',
      clientID: process.env.FORTNITE_CLIENT_ID,
      clientSecret: process.env.FORTNITE_CLIENT_SECRET,
      callbackURL: process.env.FORTNITE_CALLBACK_URL,
      scope: "basic_profile",// spaces
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      return done(null, { accessToken, refreshToken, account_id : jwt.decode(accessToken)?.sub });
    }
  )
);

// Start authentication flow
fortniteRouter.get(
  '/',
  isConnected,
  async (req: Request, res: Response, next) => {
    Logger.info(`${FORTNITE_APP}: Request for Oauth has been received successfully on session Id ${req.sessionID}`)
    req?.session?.redirectParams = {
      isWidget: req?.query?.isWidget,
      origin: req?.query?.origin,
      apps: req?.query?.apps,
    };

    passport.authenticate('fortnite')(req, res, next);
  });

// Callback handler
fortniteRouter.get('/callback', passport.authenticate('fortnite', { session: false }), async (req, res) => {
  try {

    Logger.info(`${FORTNITE_APP}: Callback has been received successfully on session Id${req.sessionID}`);
    let url: any;
    const { isWidget, origin, apps } = req.session.redirectParams;
    const serverSentEventResponse = activeConnections.get(req.sessionID);
    req.session.user = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken,
      account_id : req.user.account_id
    }

    if (isWidget == 'true')
      url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    else if (isWidget == 'false')
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    else {
      Logger.info(`${FORTNITE_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    }

    Logger.info(`${FORTNITE_APP}: Redirecting to ${url}`);
    // it will redirect to the dashboard or widget
    res.redirect(url);
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);

    // Send a message to the client that the token has been received
    if (req?.user?.accessToken && serverSentEventResponse) {
      serverSentEventResponse.write(`data: {"message":"received", "app":"${FORTNITE_APP}"}\n\n`)
      Logger.info(`${FORTNITE_APP}: Access token received successfully`);
    }
    else {
      Logger.error("An error occurred while accessing session");
      return res.status(401).json({ app: FORTNITE_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
    }

  } catch (error: any) {
    Logger.error(`${FORTNITE_APP}: Error during callback: ${error.message}`);
    res.status(401).json({ app: FORTNITE_APP, error: 'Unauthorized', message: 'Error during callback' });
  }
});

// Callback handler
fortniteRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    Logger.info(`${FORTNITE_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
    const { accessToken ,account_id}: any = req?.session?.user;
    let userFortnite = { data: {} }

    if (accessToken) {
      try {
        userFortnite = await axios.get(
          `https://api.epicgames.dev/epic/id/v2/accounts?accountId=${account_id}`,
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
          Logger.error(`${FORTNITE_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${FORTNITE_APP}: An error occurred: ${error.message}`);
        }
      }
      
      const fortniteProfile = new FortniteProfile(userFortnite?.data[0]);
  
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          Logger.error(`${FORTNITE_APP}: Error during session destroy: ${err.message}`);
          return res.status(500).json({ app: FORTNITE_APP, message: "Error during session destroy", error: err });
        }
        Logger.info(`${FORTNITE_APP}: Session destroyed successfully`);
        Logger.info(`${FORTNITE_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: FORTNITE_APP, message: "success", fortniteProfile: fortniteProfile})
      });
    } else {
      Logger.error(`${FORTNITE_APP}: Token has been expired.`);
      return res.status(401).json({ app: FORTNITE_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${FORTNITE_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: FORTNITE_APP, error: 'Request Timeout', message: 'Session has expired. Please log in again.' });
    }
    else {
      Logger.error(`${FORTNITE_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(401).json({ app: FORTNITE_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
    }
  }
});