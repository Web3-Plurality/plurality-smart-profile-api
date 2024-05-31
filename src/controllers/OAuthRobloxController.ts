import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { scrape } from "../utils/scrape";
import { TwitterProfile } from "../entity/Twitter";
import { calculateReputation } from "../utils/twitter";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { ROBLOX_APP, activeConnections } from "../utils/global";
import OAuthRobloxStrategy from "../auth/OAuthRobloxStrategy";

dotenv.config();

export const robloxRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  console.log("serialize")
  console.log(user)
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  console.log("deserialize")

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
      scope: "openid profile user.social.read",// spaces
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      console.log("Verify")
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
    
    Logger.info(`${ROBLOX_APP}: Callback from Twitter has been received successfully on session Id${req.sessionID}`);
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
      Logger.info(`${ROBLOX_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
    }

    Logger.info(`${ROBLOX_APP}: Redirecting to ${url}`);
    // it will redirect to the dashboard or widget
    res.redirect(url);
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);

    // Send a message to the client that the token has been received
    if (req?.user?.accessToken && serverSentEventResponse) {
      serverSentEventResponse.write(`data: {"message":"received", "app":"${ROBLOX_APP}"}\n\n`)
      Logger.info(`${ROBLOX_APP}: Access token of Twitter received successfully`);
    }
    else {
      Logger.error("An error occurred while accessing session"); 
      return res.status(401).json({ app: ROBLOX_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
    }

  } catch (error: any) {
    Logger.error(`${ROBLOX_APP}: Error during callback: ${error.message}`);
    res.status(401).json({ app: ROBLOX_APP, error: 'Unauthorized', message: 'Error during callback' });
  }
});

// Callback handler
robloxRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    Logger.info(`${ROBLOX_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
    const { accessToken }: any = req?.session?.user;
    let userRoblox = { data: { data: {  } } }

    if (accessToken) {
      // const tweetFields = [
      //   'attachments', 'author_id', 'context_annotations', 'conversation_id', 'created_at', 'edit_controls', 'entities', 'geo', 'id', 'in_reply_to_user_id', 'lang', 'non_public_metrics', 'public_metrics', 'organic_metrics', 'promoted_metrics', 'possibly_sensitive', 'referenced_tweets', 'reply_settings', 'source', 'text', 'withheld'
      // ];
      // const userFields = [
      //   'created_at', 'description', 'entities', 'id', 'location', 'most_recent_tweet_id', 'name', 'pinned_tweet_id', 'profile_image_url', 'protected', 'public_metrics', 'url', 'username', 'verified', 'verified_type', 'withheld'
      // ]

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

      // const data: any = {
      //   ...userTweet?.data?.data
      // }
      // const public_metrics = data?.public_metrics;
      // delete data?.public_metrics;
      // let tweetUrl1 = '';
      // let tweetUrl2 = '';
      // let pinnedTweet1: any;
      // let pinnedTweet2: any;
      // let interests: [] = [];
      // let introTags:[] = [];

      // if (data?.pinned_tweet_id !== data?.most_recent_tweet_id && data?.pinned_tweet_id  && data?.most_recent_tweet_id) {
      //   tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
      //   tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
      //   pinnedTweet1 = await scrape(tweetUrl1);
      //   pinnedTweet2 = await scrape(tweetUrl2);
      //   interests = pinnedTweet1?.interests.concat(pinnedTweet2?.interests);
      //   introTags = pinnedTweet1?.introTags.concat(pinnedTweet2?.introTags);

      // }
      // else if (data?.pinned_tweet_id === data?.most_recent_tweet_id && data?.pinned_tweet_id  && data?.most_recent_tweet_id) {
      //   tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
      //   pinnedTweet2 = await scrape(tweetUrl2);
      //   interests = pinnedTweet2?.interests;
      //   introTags = pinnedTweet2?.introTags;

      // }
      // else if (data?.pinned_tweet_id) {
      //   tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
      //   pinnedTweet1 = await scrape(tweetUrl1);
      //   interests = pinnedTweet1?.interests;
      //   introTags = pinnedTweet1?.introTags;
      // }
      // else if (data?.most_recent_tweet_id) {
      //   tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
      //   pinnedTweet2 = await scrape(tweetUrl2)
      //   interests = pinnedTweet2?.interests;
      //   introTags = pinnedTweet2?.introTags;
      // }

      // const twitterProfile = new TwitterProfile(
      //   data?.id,
      //   public_metrics?.followers_count,
      //   public_metrics?.following_count,
      //   public_metrics?.tweet_count,
      //   public_metrics?.listed_count,
      //   public_metrics?.like_count,
      //   data?.pinned_tweet_id,
      //   data?.verified_type,
      //   data?.protected,
      //   data?.username,
      //   data?.most_recent_tweet_id,
      //   data?.verified,
      //   data?.description,
      //   data?.created_at,
      //   data?.name,
      //   data?.profile_image_url,
      //   interests,
      //   0,
      //   introTags
      // )
      // Calculate reputation score
      // const reputationScore = calculateReputation(twitterProfile);
      // twitterProfile.reputationScore = reputationScore;
      // Destroy the session data

      // console.log(userRoblox)
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          Logger.error(`${ROBLOX_APP}: Error during session destroy: ${err.message}`);
          return res.status(500).json({ app: ROBLOX_APP, message: "Error during session destroy", error: err });
        }
        Logger.info(`${ROBLOX_APP}: Session destroyed successfully`);
        Logger.info(`${ROBLOX_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: ROBLOX_APP, message: "success", robloxProfile: userRoblox?.data  })
      });
    } else {
      Logger.error(`${ROBLOX_APP}: Token has been expired.`);
      return res.status(401).json({ app: ROBLOX_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: ROBLOX_APP, error: 'Request Timeout', message: 'Session has expired. Please log in again.' });
  }
  else{
    Logger.error(`${ROBLOX_APP}: Error occurred in fetching user informantion: ${error.message}`);
    return res.status(401).json({ app: ROBLOX_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
  }
  }
});