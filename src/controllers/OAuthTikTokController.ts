import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import TikTokOAuth2Strategy from "../auth/OAuthTikTokStrategy"
export const tiktokRouter = express.Router();
import passport from "passport";
import axios from "axios";
import { activeConnections, isAuthenticated } from "../utils";
import { TikTokProfile } from "../entity/Tiktok";



dotenv.config();
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
    callbackURL: `https://app.plurality.local:5000/oauth-tiktok/callback`,
    scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
    state: false
  },
  // Verify callback
  (accessToken: any, refreshToken: any, profile: any, done: any) => {
    return done(null, { accessToken: accessToken, refreshToken: refreshToken });
  }
));









tiktokRouter.get('/', async (req: Request, res: Response, next) => {


  const connection = activeConnections.get(req.sessionID);
  if (!connection) {
    return res.status(400).send("Register Event first");
  }
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

    console.log("id", req.sessionID);
    console.log(">>>>>>>>>>>>>>", req.session);
    console.log(">>>>>>>>>>>>>", req.user);
    let url: any;
    const sseRes = activeConnections.get(req.sessionID);
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
      console.log('Did not find the isWidget parameter in callback. Redirecting to default dashboard');
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    }

    
    if (req.user.accessToken && sseRes) {
      sseRes.write(`data: {"message":"received"}\n\n`)
  }
  else{
    res.status(500).send("An error occurred while accessing session");
  }
  

    // res.redirect(url);
    res.send(url);
  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred during the login process.");
  }
});

tiktokRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    console.log("id", req.sessionID)
    console.log(">>>>>>>>>>>>>>", req.session)
    const { accessToken }: any = req?.session?.user;

    if (accessToken) {
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

      // request for user info
      const userData = await axios.get(
        `https://open.tiktokapis.com/v2/user/info/?fields=${userObjField.join(",")}`,

        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      //request for videoObj list of user
      const videoList = await axios.post(
        `https://open.tiktokapis.com/v2/video/list/?fields=${videoObjFields.join(",")}`,

        {
          max_count: 20
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("##########UserInfo#####\n\n")
      console.log(userData.data);
      console.log("##########VideoInfo#####\n\n")
      console.log(videoList?.data?.data?.videos);

      const tiktokProfile = new TikTokProfile({ user: userData?.data?.data?.user, video: videoList?.data?.data?.videos });

      // Destroy the session data
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          return res.status(500).json({ app: "TikTok", message: "internal server error", error: err });
        }
        // Redirect to the home page after logging out
        return res.status(200).json({ app: "TiTok", message: "success", data: { tiktokProfile } })
      });

    } else {
      res.status(500).send("access token expires");
    }
  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred during the login process.");
  }
});