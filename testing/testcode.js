import express, { Request, Response } from "express";
import passport, { session } from "passport";
// import { Strategy } from '@superfaceai/passport-twitter-oauth2';
import OAuthTwitterStrategy from '../auth/OAuthTwitterStrategy';
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated } from "../utils";
import { scrape } from "../utils/scrape";
import { PinnedTweet, TwitterProfile } from "../classes/twitter";


export const twitterRouter = express.Router();

dotenv.config();

const activeConnections = new Map();

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





function initSSE(req:Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // const id = new Date().toISOString();
  // res.write(`id: ${id}\n`);
  res.write(`data: {"message":"Connection established"}\n\n`);

  // console.log("res>>>>>",res)
  // Store the response object in session for later use to push events

  
  // req.session.save();

    // Store the connection using session ID
    activeConnections.set(req.sessionID,  res );

  // Keep the connection alive with comments
  // const keepAlive = setInterval(() => {
  //   res.write(`data: {"message":"keep-alive"}\n\n`);
  // }, 20000);

  req.on('close', () => {
    // clearInterval(keepAlive);
    activeConnections.delete(req.sessionID);
    res.end();
});

}


twitterRouter.get('/register', (req:Request, res:Response) => {
  const connection = activeConnections.get(req.sessionId);
  if (!connection) {
    req.session.save();
    res.status(200).json({"message":"session has been created."})
  } else {
    res.status(400).send("session already created.");
  }
});



twitterRouter.get('/register-event', (req:Request, res:Response) => {
  const connection = activeConnections.get(req.sessionId);
  if (!connection) {
    initSSE(req, res);
  } else {
    res.status(400).send("Event stream already open for this session");
  }
});


// Start authentication flow
twitterRouter.get(
  '/',
  async (req: Request, res: Response, next) => {
    const connection = activeConnections.get(req.sessionId);
    if (!connection) {
      res.status(400).send("Register Event first");
  } 

    req?.session?.redirectParams = {
      isWidget: req?.query?.isWidget,
      origin: req?.query?.origin,
      apps: req?.query?.apps,
    };

    // req.session.save()
    passport.authenticate('twitter')(req, res, next);
  });

// Callback handler
twitterRouter.get('/callback', passport.authenticate('twitter', { session: false }), async (req, res) => {
  try {
    console.log("id", req.sessionID);
    console.log(">>>>>>>>>>>>>>", req.session);
    // request for user info
    console.log(">>>>>>>>>>>>>", req.user);
    
  //  console.log(">>>>>>>>sssss",req.session.sseConnection) 
    // if (req.user.accessToken) {
    //   if (req.session.sseConnection) {
    //     const sseRes = req.session.sseConnection;
    //     sseRes.write(`data: ${JSON.stringify({ message: 'Callback received', data: req.user })}\n\n`);
    //   }
    // }
    
    req.session.user = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    }




    const { isWidget, origin, apps } = req.session.redirectParams;
    let url: any;

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

}
);


// Callback handler
twitterRouter.get('/info', isAuthenticated, async (req, res) => {
  try {

    console.log("id", req.sessionID)
    console.log(">>>>>>>>>>>>>>", req.session)

    // console.log(isWidget, origin, apps)
    const { accessToken }: any = req?.session?.user;

    // request for user info
    console.log(accessToken)
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

      const tweetUrl = `https://twitter.com/${data['username']}/status/${data['pinned_tweet_id']}`

      const pinnedTweet = await scrape(tweetUrl);

      const pt = new PinnedTweet(
        tweetUrl,
        pinnedTweet?.username,
        pinnedTweet?.Views,
        pinnedTweet?.date,
        pinnedTweet?.Reposts,
        pinnedTweet?.Quotes,
        pinnedTweet?.Likes,
        pinnedTweet?.Bookmarks,
        pinnedTweet?.tweetText,
        pinnedTweet?.interests);   

        const twitterProfile = new TwitterProfile(
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
          data?.id

        )

      // Destroy the session data
      req.session.destroy(err => {
        if (err) {
          return res.status(500).json({ app: "X", message: "internal server error", error: err });
        }
        // Redirect to the home page after logging out
        return res.status(200).json({ app: "X", message: "success", data: { twitterProfile : twitterProfile, pinnedTweet : pt } })
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
