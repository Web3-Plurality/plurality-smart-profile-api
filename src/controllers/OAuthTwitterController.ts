import express, { Request, Response } from "express";
import passport from "passport";
import OAuthTwitterStrategy from '../auth/OAuthTwitterStrategy';
import * as dotenv from 'dotenv';
import axios from "axios";
import { scrape, calculateReputation } from "../utils/twitter";
import { TwitterProfile } from "../entity/Twitter";
import { hasValidAccessTokenHeader, hasValidEventHeader, hasValidEventParam } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INTERNAL_SERVER_ERROR, TIMEOUT_ERROR, TWITTER_APP, memoryStore } from "../utils/global";
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

export const twitterRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use(
  "twitter",
  // Strategy initialization
  new OAuthTwitterStrategy(
    {
      authorizationURL: 'https://twitter.com/i/oauth2/authorize',
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
      clientID: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      callbackURL: process.env.TWITTER_CALLBACK_URL,
      scope: "tweet.read users.read offline.access", //space
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
twitterRouter.get(
  '/',
  hasValidEventParam,
  async (req: Request, res: Response, next) => {
    Logger.info(`${TWITTER_APP}: Request for Twitter Oauth has been received successfully on sse Id ${req.sseID}`)
    passport.authenticate('twitter')(req, res, next);
  });

// Callback handler
twitterRouter.get('/callback', passport.authenticate('twitter', { session: false }), async (req, res) => {
  try {
    const accessTokenId = uuidv4();
    memoryStore.set(accessTokenId, req.user.accessToken);
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}`;
    Logger.info(`${TWITTER_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${TWITTER_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: TWITTER_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
twitterRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  async (req: Request, res: Response) => {
    try {
      Logger.info(`${TWITTER_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${TWITTER_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStore.get(req?.sseID);
      serverSentEventResponse.write(`data: {"message":"received", "app":"${TWITTER_APP}", "auth":"${req?.accessTokenID}"}\n\n`)
      Logger.info(`${TWITTER_APP}: Server Side Event has been sent successfully`);
      memoryStore.delete(req?.sseID);
      return res.status(200).json({ app: TWITTER_APP, message: "success" });  
    } catch (error) {
      Logger.info(`${TWITTER_APP}: Error in sending event ${error.message}`);
      return res.status(500).json({ app: TWITTER_APP, message: "Internal Server error" }); 
    }
    
  });

// Return User Object
twitterRouter.get('/info', hasValidAccessTokenHeader, async (req, res) => {
  try {
    Logger.info(`${TWITTER_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStore.get(req.accessTokenID)
    let userTweet = { data: { data: {  } } }

    if (accessToken) {
      const tweetFields = [
        'attachments', 'author_id', 'context_annotations', 'conversation_id', 'created_at', 'edit_controls', 'entities', 'geo', 'id', 'in_reply_to_user_id', 'lang', 'non_public_metrics', 'public_metrics', 'organic_metrics', 'promoted_metrics', 'possibly_sensitive', 'referenced_tweets', 'reply_settings', 'source', 'text', 'withheld'
      ];
      const userFields = [
        'created_at', 'description', 'entities', 'id', 'location', 'most_recent_tweet_id', 'name', 'pinned_tweet_id', 'profile_image_url', 'protected', 'public_metrics', 'url', 'username', 'verified', 'verified_type', 'withheld'
      ]

      try { 
        userTweet = await axios.get(
        `https://api.twitter.com/2/users/me?expansions=pinned_tweet_id&tweet.fields=${tweetFields.join(",")}&user.fields=${userFields.join(",")}`,
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
        Logger.error(`${TWITTER_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      } else {
        Logger.error(`${TWITTER_APP}: An error occurred: ${error.message}`);
      }
    }

      const data: any = {
        ...userTweet?.data?.data
      }
      const public_metrics = data?.public_metrics;
      delete data?.public_metrics;
      let tweetUrl1 = '';
      let tweetUrl2 = '';
      let pinnedTweet1: any;
      let pinnedTweet2: any;
      let interests: [] = [];
      let introTags:[] = [];

      if (data?.pinned_tweet_id !== data?.most_recent_tweet_id && data?.pinned_tweet_id  && data?.most_recent_tweet_id) {
        tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
        tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
        pinnedTweet1 = await scrape(tweetUrl1);
        pinnedTweet2 = await scrape(tweetUrl2);
        interests = pinnedTweet1?.interests.concat(pinnedTweet2?.interests);
        introTags = pinnedTweet1?.introTags.concat(pinnedTweet2?.introTags);

      }
      else if (data?.pinned_tweet_id === data?.most_recent_tweet_id && data?.pinned_tweet_id  && data?.most_recent_tweet_id) {
        tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
        pinnedTweet2 = await scrape(tweetUrl2);
        interests = pinnedTweet2?.interests;
        introTags = pinnedTweet2?.introTags;

      }
      else if (data?.pinned_tweet_id) {
        tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
        pinnedTweet1 = await scrape(tweetUrl1);
        interests = pinnedTweet1?.interests;
        introTags = pinnedTweet1?.introTags;
      }
      else if (data?.most_recent_tweet_id) {
        tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
        pinnedTweet2 = await scrape(tweetUrl2)
        interests = pinnedTweet2?.interests;
        introTags = pinnedTweet2?.introTags;
      }

      const twitterProfile = new TwitterProfile(
        data?.id,
        public_metrics?.followers_count,
        public_metrics?.following_count,
        public_metrics?.tweet_count,
        public_metrics?.listed_count,
        public_metrics?.like_count,
        data?.pinned_tweet_id,
        data?.verified_type,
        data?.protected,
        data?.username,
        data?.most_recent_tweet_id,
        data?.verified,
        data?.description,
        data?.created_at,
        data?.name,
        data?.profile_image_url,
        interests,
        0,
        introTags
      )
      // Calculate reputation score
      const reputationScore = calculateReputation(twitterProfile);
      twitterProfile.reputationScore = reputationScore;
     
      memoryStore.delete(req?.accessTokenID);
      Logger.info(`${TWITTER_APP}: Session destroyed successfully`);
      Logger.info(`${TWITTER_APP}: User information has been delivered successfully`);
      return res.status(200).json({ app: TWITTER_APP, message: "success", twitterProfile: twitterProfile  })
  
    } else {
      Logger.error(`${TWITTER_APP}: Token has been expired.`);
      return res.status(500).json({ app: TWITTER_APP,  message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${TWITTER_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: TWITTER_APP, message: TIMEOUT_ERROR });
  }
  else{
    Logger.error(`${TWITTER_APP}: Error occurred in fetching user informantion: ${error.message}`);
    return res.status(500).json({ app: TWITTER_APP,  message: INTERNAL_SERVER_ERROR });
  }
  }
});