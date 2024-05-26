import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import TikTokOAuth2Strategy from "../auth/OAuthTikTokStrategy"
import passport from "passport";
import axios from "axios";
import { TikTokProfile } from "../entity/Tiktok";
import { TIKTOK_APP, activeConnections } from "../utils/global";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import { analyzeTweet } from "../utils/groq";
import { calculateReputation } from "../utils/tiktok";
import Logger from "../lib/logger";

dotenv.config();

export const tiktokRouter = express.Router();
// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use("tiktok", new TikTokOAuth2Strategy(
  // Strategy initialization
  {
    authorizationURL: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenURL: 'https://open.tiktokapis.com/v2/oauth/token/',
    clientKey: process.env.TIKTOK_CLIENT_ID,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    callbackURL: process.env.TIKTOK_CALLBACK_URL,
    scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
    state: false
  },
  // Verify callback
  (accessToken: any, refreshToken: any, profile: any, done: any) => {
    return done(null, { accessToken: accessToken, refreshToken: refreshToken });
  }
));

tiktokRouter.get('/', isConnected, async (req: Request, res: Response, next) => {

  Logger.info(`${TIKTOK_APP}: Request for Tiktok Oauth has been received successfully on session Id${req.sessionID}`)
  req?.session?.redirectParams = {
    isWidget: req?.query?.isWidget,
    origin: req?.query?.origin,
    apps: req?.query?.apps,
  };
  const csrfState = Math.random().toString(36).substring(2);
  passport.authenticate('tiktok', { state: csrfState })(req, res, next);
})

tiktokRouter.get('/callback', passport.authenticate("tiktok", { session: false }), async (req, res) => {
  try {
    Logger.info(`${TIKTOK_APP}: Callback from Tiktok has been received successfully on session Id${req.sessionID}`);

    let url: any;
    const serverSentEventResponse = activeConnections.get(req.sessionID);
    const { isWidget, origin, apps } = req.session.redirectParams;

    req.session.user = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    }

    if (isWidget == 'true')
      url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    else if (isWidget == 'false')
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    else {
      Logger.info(`${TIKTOK_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    }

    Logger.info(`${TIKTOK_APP}: Redirecting to ${url}`);

    // it will redirect to the dashboard or widget
    res.redirect(url);
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);

    // Send a message to the client that the token has been received
    if (req.user.accessToken && serverSentEventResponse) {
      serverSentEventResponse.write(`data: {"message":"received", "app":"${TIKTOK_APP}"}\n\n`)
      Logger.info(`${TIKTOK_APP}: Access token of Tiktok received successfully`);
    } else {
      Logger.error(`${TIKTOK_APP}: Event source connection not found.`);
      return res.status(401).json({ app: TIKTOK_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
    }

  } catch (error: any) {
    Logger.error(`${TIKTOK_APP}: Error during callback:, ${error.message}`);
    res.status(401).json({ app: TIKTOK_APP, error: 'Unauthorized', message: 'Error during callback' });
  }
});

tiktokRouter.get('/info', isAuthenticated, async (req, res) => {
  try {

    Logger.info(`${TIKTOK_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
    const { accessToken }: any = req?.session?.user;

    if (accessToken) {
      let userData = { data: { data: { user: {} } } }
      let videoList = { data: { data: { videos: [] } } }
      const userObjField = [
        "open_id",
        "union_id",
        "avatar_url",
        "display_name",
        "bio_description",
        "profile_deep_link",
        "is_verified",
        "username",
        "follower_count",
        "following_count",
        "likes_count",
        "video_count"
      ];
      const videoObjFields = [
        "id",
        "create_time",
        "cover_image_url",
        "share_url",
        "video_description",
        "duration",
        "height",
        "width",
        "title",
        // "embed_html", //not seems to be useful
        "embed_link",
        "like_count",
        "comment_count",
        "share_count",
        "view_count"
      ]


      try {
        // request for user info
        userData = await axios.get(
          `https://open.tiktokapis.com/v2/user/info/?fields=${userObjField.join(",")}`,
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
          Logger.error(`${TIKTOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${TIKTOK_APP}: An error occurred: ${error.message}`);
        }
      }

      try {
        //request for videoObj list of user
        videoList = await axios.post(
          `https://open.tiktokapis.com/v2/video/list/?fields=${videoObjFields.join(",")}`,
          {
            max_count: 5, // env variable put
          },
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
          Logger.error(`${TIKTOK_APP}: Request timeout error: ${error.message}`);
        } else {
          Logger.error(`${TIKTOK_APP}: An error occurred: ${error.message}`);
        }
      }

      const tiktokProfile = new TikTokProfile({ user: userData?.data?.data?.user, video: videoList?.data?.data?.videos });
      const vidDescription = tiktokProfile?.video?.length ? tiktokProfile?.video.map((vid: any) => vid?.title + " " + vid?.videoDescription).join(' ') : ""
      const semanticObj = tiktokProfile?.user?.bioDescription ? await analyzeTweet(tiktokProfile?.user?.bioDescription + vidDescription) : {}
      const reputationScore = calculateReputation(tiktokProfile);
      tiktokProfile.interests = semanticObj?.Interests || [];
      tiktokProfile.introTags = semanticObj?.IntroTags || [];

      tiktokProfile.reputationScore = reputationScore;

      // Destroy the session data
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          Logger.error(`${TIKTOK_APP}: Error during session destroy: ${err.message}`);
          return res.status(500).json({ app: TIKTOK_APP, message: "Error during session destroy", error: err });
        }
        Logger.info(`${TIKTOK_APP}: Session destroyed successfully`);
        Logger.info(`${TIKTOK_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: TIKTOK_APP, message: "success",tiktokProfile: tiktokProfile })
      });
    } else {
      Logger.error(`${TIKTOK_APP}: Token has been expired.`);
      return res.status(401).json({ app: TIKTOK_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
    }
  } catch (error: any) {
    Logger.error(`${TIKTOK_APP}: Error occurred in fetching user informantion: ${error.message}`);
    return res.status(401).json({ app: TIKTOK_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
  }
});