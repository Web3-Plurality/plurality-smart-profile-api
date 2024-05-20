import express, { Request, Response } from "express";
import passport from "passport";
// import { Strategy } from '@superfaceai/passport-twitter-oauth2';
import OAuthTwitterStrategy from '../auth/OAuthTwitterStrategy';
import * as dotenv from 'dotenv';
import axios from "axios";
import { activeConnections, isAuthenticated } from "../utils";
import { scrape } from "../utils/scrape";
import { TwitterProfile } from "../entity/twitter";
import { calculateReputation } from "../utils/twitter";

export const twitterRouter = express.Router();

dotenv.config();

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
      console.log("Verify")
      return done(null, { accessToken, refreshToken, profile });
    }
  )
);


// Start authentication flow
twitterRouter.get(
  '/',
  async (req: Request, res: Response, next) => {

    const connection = activeConnections.get(req.sessionID);
    if (!connection) {
      return res.status(400).send("Register Event first");
    }

    req?.session?.redirectParams = {
      isWidget: req?.query?.isWidget,
      origin: req?.query?.origin,
      apps: req?.query?.apps,
    };

    passport.authenticate('twitter')(req, res, next);
  });

// Callback handler
twitterRouter.get('/callback', passport.authenticate('twitter', { session: false }), async (req, res) => {
  try {
    console.log("id", req.sessionID);
    console.log(">>>>>>>>>>>>>>", req.session);
    // request for user info
    console.log(">>>>>>>>>>>>>", req.user);

    let url: any;
    const { isWidget, origin, apps } = req.session.redirectParams;
    const sseRes = activeConnections.get(req.sessionID);


    if (req.user.accessToken && sseRes) {
      sseRes.write(`data: {"message":"received"}\n\n`)
    }
    else {
      res.status(500).send("An error occurred while accessing session");
    }

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
    // res.redirect(url);
    res.send(url);
  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred while fetching data");
  }
});


// Callback handler
twitterRouter.get('/info', isAuthenticated, async (req, res) => {
  try {

    console.log("id", req.sessionID)
    console.log(">>>>>>>>>>>>>>", req.session)

    const { accessToken }: any = req?.session?.user;

    if (accessToken) {
      const tweetFields = [
        'attachments', 'author_id', 'context_annotations', 'conversation_id', 'created_at', 'edit_controls', 'entities', 'geo', 'id', 'in_reply_to_user_id', 'lang', 'non_public_metrics', 'public_metrics', 'organic_metrics', 'promoted_metrics', 'possibly_sensitive', 'referenced_tweets', 'reply_settings', 'source', 'text', 'withheld'
      ];
      const userFields = [
        'created_at', 'description', 'entities', 'id', 'location', 'most_recent_tweet_id', 'name', 'pinned_tweet_id', 'profile_image_url', 'protected', 'public_metrics', 'url', 'username', 'verified', 'verified_type', 'withheld'
      ]
      const userTweet = await axios.get(
        `https://api.twitter.com/2/users/me?expansions=pinned_tweet_id&tweet.fields=${tweetFields.join(",")}&user.fields=${userFields.join(",")}`,

        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(userTweet?.data)
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

      if (data?.pinned_tweet_id !== data?.most_recent_tweet_id && data?.pinned_tweet_id !== '' && data?.most_recent_tweet_id !== '') {

        console.log("yyyyyyyyyyyyyy")
        tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
        tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
        pinnedTweet1 = await scrape(tweetUrl1);
        pinnedTweet2 = await scrape(tweetUrl2);
        interests = pinnedTweet1?.interests.concat(pinnedTweet2?.interests);
      }
      else if (data?.pinned_tweet_id !== '') {

        tweetUrl1 = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`
        pinnedTweet1 = await scrape(tweetUrl1);
        interests = pinnedTweet1?.interests;
      }
      else if (data?.most_recent_tweet_id !== '') {

        tweetUrl2 = `https://twitter.com/${data['username']}/status/${data['most_recent_tweet_id']}`
        pinnedTweet2 = await scrape(tweetUrl2)
        interests = pinnedTweet2?.interests;
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
        interests
      )

      // Calculate reputation score
      const reputationScore = calculateReputation(twitterProfile);
      twitterProfile.reputationScore = reputationScore;

      // Destroy the session data
      req.session.destroy(err => {
        activeConnections.delete(req.sessionID);
        if (err) {
          return res.status(500).json({ app: "X", message: "internal server error", error: err });
        }
        // Redirect to the home page after logging out
        return res.status(200).json({ app: "X", message: "success", data: { twitterProfile: twitterProfile } })
      });
      // Todo: Need to loook other properties which can be come for proper structuring of json
    } else {
      res.status(500).send("access token expires");
    }
  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred during the login process.");
  }
});
