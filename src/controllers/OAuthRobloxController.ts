import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INTERNAL_SERVER_ERROR, ROBLOX_APP, TIMEOUT_ERROR, activeConnections, createPrompt, generateJwt } from "../utils/global";
import OAuthRobloxStrategy from "../auth/OAuthRobloxStrategy";
import { RobloxProfile } from "../entity/Roblox";
import { analyze } from "../utils/groq";
import { calculateReputation, scrapRoblox } from "../utils/roblox";
import { ROBLOX_FETCH_INTEREST_PROMPT } from "../utils/aiPrompts";
import {Strategy as JwtStrategy, ExtractJwt} from 'passport-jwt';
import { v4  as uuidv4 } from 'uuid';


dotenv.config();

export const robloxRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});




const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'your_jwt_secret'
};

passport.use(new JwtStrategy(opts, function(jwtPayload, done) {
  // Find the user based on JWT payload

    console.log(">>>>>>>>>>",jwtPayload)
    if (jwtPayload) {
      return done(null, jwtPayload);
    } else {
      return done(null, false);
    }
 
}));



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
      scope: "openid profile asset:read",// spaces
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
robloxRouter.get(
  '/',
  isConnected,
  async (req: Request, res: Response, next) => {
    Logger.info(`${ROBLOX_APP}: Request for Oauth has been received successfully on sse Id${req.sseID }`)
    passport.authenticate('roblox')(req, res, next);
  });

// Callback handler
robloxRouter.get('/callback', passport.authenticate('roblox', { session: false }), async (req, res) => {
  try {
    // TODO: update this log as we wont have session id
    // Logger.info(`${ROBLOX_APP}: Callback has been received successfully on session Id${req.sessionID}`);
    // TODO: delete this line because we wont have session id here
    
    // TODO: save this in the memoryStore MAP we created before instead of session against another randomUUID (accessTokenUUID)
    // TODO: Now we have 2 randomUUIDs -> 1 for req object for SSE and 2 for access token
    const accessTokenId = uuidv4();
    // const serverSentEventResponse = activeConnections.get(req.sessionID);
    activeConnections.set(accessTokenId, req.user.accessToken);
    // req.session.user = {
    //   accessToken: req.user.accessToken,
    //   refreshToken: req.user.refreshToken
    // }

    // const token = generateJwt(req?.user?.accessToken)

    // it will redirect to the dashboard or widget
    // TODO: add the accessTokenUUID for access token we just created above in query parameters
    // TODO: The FE would get this UUID and send it in post call /send-event
    const url = "http://localhost:3000/test?accessTokenID=" + accessTokenId;
    Logger.info(`${ROBLOX_APP}: Redirecting to ${url}`);
    // it will redirect to the dashboard or widget
    res.redirect(url);
    // res.status(200).json({ app: ROBLOX_APP, message: "success", token: token });
    // it will send the url to the client, and it is for testing purpose
    // res.send(url);


    // Send a message to the client that the token has been received
    // if (req?.user?.accessToken && serverSentEventResponse) {
    //   serverSentEventResponse.write(`data: {"message":"received", "app":"${ROBLOX_APP}", "token":"${token}"}\n\n`)
    //   Logger.info(`${ROBLOX_APP}: Access token has been received successfully`);
    // }
    // else {
    //   Logger.error("An error occurred while accessing session");
    //   return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    // }

  } catch (error: any) {
    Logger.error(`${ROBLOX_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: ROBLOX_APP, message: 'Error during callback' });
  }
});

// TODO: implement a post endpoint /send-event to send server side event to iframe -> test and improve this pseudocode
robloxRouter.post(
  '/send-event',
  async (req: Request, res: Response) => {
    Logger.info(`${ROBLOX_APP}: Request body sseUUID ${req.body.sseUUID}`);
    Logger.info(`${ROBLOX_APP}: Request body sseUUID ${req.body.accessTokenUUID}`);
    const serverSentEventResponse = activeConnections.get(req.body.sseUUID);
   // Send a message to the client that the token has been received
  //  write me auth ki zrurat nhi hai
    serverSentEventResponse.write(`data: {"message":"received", "app":"${ROBLOX_APP}", "auth":"${req.body.accessTokenUUID}"}\n\n`)
    Logger.info(`${ROBLOX_APP}: Server Side Event has been sent successfully`);
    return res.status(200).json({ app: ROBLOX_APP, message: "success" });
  });

// Callback handler
robloxRouter.get('/info', isAuthenticated, async (req, res) => {
  try {
    Logger.info(`${ROBLOX_APP}: Request for information has been received successfully on session Id ${req.accessTokenID}`);
    // TODO: fetch this from memoryStore MAP againt accessTokenUUID

    const accessToken  = activeConnections.get(req.accessTokenID)

    let userRoblox = { data: {} }
    let inventoryData = []

    if (accessToken) {
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

      const robloxProfile = new RobloxProfile(userRoblox?.data);

      try {
        const userData = await axios.get(
          `https://apis.roblox.com/cloud/v2/users/${userRoblox?.data?.sub}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );

        const prompt = createPrompt(ROBLOX_FETCH_INTEREST_PROMPT, userData?.data?.about);
        const interests = await analyze(prompt);
        robloxProfile.interests = interests?.Interests || [];
        robloxProfile.introTags = interests?.IntroTags || [];
        robloxProfile.idVerified = userData?.data?.idVerified;
        robloxProfile.premium = userData?.data?.premium;

      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }

      try {
        inventoryData = await axios.get(
          `https://apis.roblox.com/cloud/v2/users/${userRoblox?.data?.sub}/inventory-items`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 20000,
          }
        );
        robloxProfile.assests = inventoryData?.data?.inventoryItems;
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
        }
      }


      // try {
      //   console.log("asset Id")
      //   console.log(robloxProfile.assests[0]?.assetDetails?.assetId)
      //   const asset = await axios.get(
      //     `https://apis.roblox.com/assets/v1/assets/${robloxProfile.assests[0]?.assetDetails?.assetId}`,
      //     {
      //       headers: {
      //         Authorization: `Bearer ${accessToken}`,
      //         "Content-Type": "application/json",
      //       },
      //       timeout: 20000,
      //     }
      //   );
      //   console.log("aaaaaaaaaa")
      //   console.log(asset?.data)
      // } catch (error) {
      //   if (error.code === 'ECONNABORTED') {
      //     Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      //   } else {
      //     Logger.error(`${ROBLOX_APP}: An error occurred: ${error.message}`);
      //   }
      // }

      try {
        const robloxInsights = await scrapRoblox(robloxProfile?.profile);
        robloxProfile.joinDate = robloxInsights?.joinDate;
        robloxProfile.placesVisit = robloxInsights?.placesVisit;
        robloxProfile.friends = robloxInsights?.friends;
        robloxProfile.followers = robloxInsights?.followers;
        robloxProfile.following = robloxInsights?.following;
        robloxProfile.avtar = robloxInsights?.avtar;

      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${ROBLOX_APP}: An error occurred while scraping: ${error.message}`);
        }
      }

      robloxProfile.reputationScore += calculateReputation(robloxProfile);

      // req.session.destroy(err => {
        activeConnections.delete(req?.sseID);
        activeConnections.delete(req?.accessTokenID);

        // if (err) {
        //   Logger.error(`${ROBLOX_APP}: Error during session destroy: ${err.message}`);
        //   return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR, error: err });
        // }
        // Logger.info(`${ROBLOX_APP}: Session destroyed successfully`);
        Logger.info(`${ROBLOX_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: ROBLOX_APP, message: "success", robloxProfile: robloxProfile })
      // });
    } else {
      Logger.error(`${ROBLOX_APP}: Token has been expired.`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${ROBLOX_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: ROBLOX_APP, message: TIMEOUT_ERROR });
    }
    else {
      Logger.error(`${ROBLOX_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: ROBLOX_APP, message: INTERNAL_SERVER_ERROR });
    }
  }
});