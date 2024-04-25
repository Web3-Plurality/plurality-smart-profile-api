import express, { Request, Response } from "express";
import passport from "passport";
import { Strategy } from '@superfaceai/passport-twitter-oauth2';
import * as dotenv from 'dotenv';
import axios from "axios";


export const twitterRouter = express.Router();

dotenv.config();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});


passport.use(
  // Strategy initialization
  new Strategy(
    {
      clientID: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      clientType: 'confidential',
      callbackURL: process.env.TWITTER_CALLBACK_URL,
    },
    // Verify callback
    (accessToken, refreshToken, profile, done) => {
      console.log('Success!', { accessToken, refreshToken, profile });
      return done(null, profile);
    }
  )
);


// Start authentication flow
twitterRouter.get(
  '/',
  async (req: Request, res: Response, next) => {
    const isWidget = req.query.isWidget;
    const origin = req.query.origin;
    const apps = req.query.apps;
    console.log('isWidget: ' + isWidget);
    console.log('origin: ' + origin);
    console.log('apps: ' + apps);
    let callback = '';
    callback = `${process.env.TWITTER_CALLBACK_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`;

    // Use the Twitter OAuth2 strategy within Passport
    passport.authenticate('twitter', {
      // Scopes
      scope: ['tweet.read', 'users.read', 'offline.access'],
    }, (req: Request, res: Response) => {
      // Successful authentication
      res.redirect(callback);
    })(req, res, next)
  },

);

// Callback handler
twitterRouter.get('/callback', passport.authenticate('twitter'), async (req, res) => {


  try {

    const userData = JSON.stringify(req.user, undefined, 2);
    console.log(`${userData}`);
    const o: any = JSON.parse(userData);
    console.log(o.username);
    console.log(o.displayName);
    console.log(o.photos[0].value);
    const isWidget = req.query.isWidget;
    const origin = req.query.origin;
    const apps = req.query.apps;
    const profile_pic = o.photos[0].value;



    const { accessToken, refreshToken }: any = req?.user;
    // request for user info

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



    // if (isWidget == 'true')
    //   res.redirect(
    //     `${process.env.WIDGET_UI_URL}?isWidget=${req.query.isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter&username=${o.username}&display_name=${o.displayName}&picture_url=${profile_pic}`,
    //   );
    // else if (isWidget == 'false')
    //   res.redirect(
    //     `${process.env.DASHBOARD_UI_URL}?isWidget=${req.query.isWidget}&origin=${origin}&id_platform=twitter&username=${o.username}&display_name=${o.displayName}&picture_url=${profile_pic}`,
    //   );
    // else {
    //   console.log('Did not find the isWidget parameter in callback. Redirecting to default dashboard');
    //   res.redirect(
    //     `${process.env.DASHBOARD_UI_URL}?isWidget=${req.query.isWidget}&origin=${origin}&id_platform=twitter&username=${o.username}&display_name=${o.displayName}&picture_url=${profile_pic}`,
    //   );
    // }



    let url: any;

    if (isWidget == 'true')
      url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    else if (isWidget == 'false')
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    else {
      console.log('Did not find the isWidget parameter in callback. Redirecting to default dashboard');
      url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
    }


    tweetFields.forEach(field => {
      url += `&${field}=${userTweet?.data?.data[field]}`;
    });



    userFields.forEach(field => {
      url += `&${field}=${userTweet?.data?.data[field]}`;
    });


    res.send(url)
  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred during the login process.");
  }

}
);
