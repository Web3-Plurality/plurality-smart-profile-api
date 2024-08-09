import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import TikTokOAuth2Strategy from "../auth/OAuthTikTokStrategy"
import passport from "passport";
import axios from "axios";
import { TikTokProfile } from "../entity/Tiktok";
import { INTERNAL_SERVER_ERROR, TIKTOK_APP, memoryStore, createPrompt } from "../utils/global";
import { hasValidAccessTokenHeader, hasValidEventHeader, hasValidEventParam } from "../middlewares/authMiddleware";
import { analyze } from "../utils/groq";
import { calculateReputation } from "../utils/tiktok";
import Logger from "../lib/logger";
import { TIKTOK_FETCH_INTEREST_PROMPT } from "../utils/aiPrompts";
import { v4 as uuidv4 } from 'uuid';
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

// Start authentication flow
tiktokRouter.get('/', hasValidEventParam, async (req: Request, res: Response, next) => {

  Logger.info(`${TIKTOK_APP}: Request for Tiktok Oauth has been received successfully on sse Id ${req.sseID}`)
  const csrfState = Math.random().toString(36).substring(2);
  passport.authenticate('tiktok', { state: csrfState })(req, res, next);
})

// Callback handler
tiktokRouter.get('/callback', passport.authenticate("tiktok", { session: false }), async (req, res) => {
  try {
    const accessTokenId = uuidv4();
    memoryStore.set(accessTokenId, req.user.accessToken);
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}`;
    Logger.info(`${TIKTOK_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${TIKTOK_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: TIKTOK_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
tiktokRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  async (req: Request, res: Response) => {
    try {
      Logger.info(`${TIKTOK_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${TIKTOK_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStore.get(req?.sseID);
      serverSentEventResponse.write(`data: {"message":"received", "app":"${TIKTOK_APP}", "auth":"${req?.accessTokenID}"}\n\n`)
      Logger.info(`${TIKTOK_APP}: Server Side Event has been sent successfully`);
      memoryStore.delete(req?.sseID);
      return res.status(200).json({ app: TIKTOK_APP, message: "success" });
    } catch (error) {
      Logger.info(`${TIKTOK_APP}: Error in sending event ${error.message}`);
      return res.status(500).json({ app: TIKTOK_APP, message: "Internal Server error" });
    }

  });

// Return User Object
tiktokRouter.get('/info', hasValidAccessTokenHeader, async (req, res) => {
  try {

    Logger.info(`${TIKTOK_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStore.get(req.accessTokenID)

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
            max_count: 20, // env variable put
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
      const prompt = createPrompt(TIKTOK_FETCH_INTEREST_PROMPT, tiktokProfile?.user?.bioDescription + vidDescription)
      const semanticObj = tiktokProfile?.user?.bioDescription ? await analyze(prompt) : {}
      const reputationScore = calculateReputation(tiktokProfile);
      tiktokProfile.interests = semanticObj?.Interests || [];
      tiktokProfile.introTags = semanticObj?.IntroTags || [];

      tiktokProfile.reputationScore = reputationScore;

      memoryStore.delete(req?.accessTokenID);
      Logger.info(`${TIKTOK_APP}: Session destroyed successfully`);
      Logger.info(`${TIKTOK_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: TIKTOK_APP, message: "success", tiktokProfile: tiktokProfile })

    } else {
      Logger.error(`${TIKTOK_APP}: Token has been expired.`);
      return res.status(500).json({ app: TIKTOK_APP, message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    Logger.error(`${TIKTOK_APP}: Error occurred in fetching user informantion: ${error.message}`);
    return res.status(500).json({ app: TIKTOK_APP, message: INTERNAL_SERVER_ERROR });
  }
});