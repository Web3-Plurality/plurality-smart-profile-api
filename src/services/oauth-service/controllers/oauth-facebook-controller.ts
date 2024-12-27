import express, { Request, Response } from 'express';
import passport from 'passport';
import * as dotenv from 'dotenv';
import axios from 'axios';
import {
  hasValidAccessTokenHeader,
  hasValidEventHeader,
  hasValidEventParam,
  isAuthenticated,
  isProfileMapEmpty,
} from '../middlewares/oauth-middleware';
import Logger from '../../../lib/logger';
import { memoryStoreToken, memoryStoreSSE, memoryStoreProfile, ScoreTypes } from '../../../utils/global';
import { FACEBOOK_APP, INTERNAL_SERVER_ERROR, TIMEOUT_ERROR } from '../utils/constants';
import OAuthFacebookStrategy from '../strategies/OAuthFacebookStrategy';
import { analyze } from '../utils/groq';
import { FacebookProfile } from '../entity/facebook';
import { calculateReputation, extractContent, getPagingData, sanitizeObject } from '../utils/facebook';
import {
  createPrompt,
  FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT,
  FACEBOOK_FETCH_INTEREST_PROMPT,
} from '../utils/ai-prompts';
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile } from '../../user-service/entity/smart-profile';

dotenv.config();

export const facebookRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});

passport.use(
  'facebook',
  // Strategy initialization
  new OAuthFacebookStrategy(
    {
      authorizationURL: 'https://www.facebook.com/v20.0/dialog/oauth',
      tokenURL: 'https://graph.facebook.com/v20.0/oauth/access_token',
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      scope: 'public_profile,email,user_likes,user_location,user_posts,user_friends',
      state: true,
      pkce: true,
    },
    // Verify callback
    (accessToken: any, refreshToken: any, profile: any, done: any) => {
      return done(null, { accessToken, refreshToken, profile });
    },
  ),
);

// Start authentication flow
facebookRouter.get('/', hasValidEventParam, isProfileMapEmpty, async (req: Request, res: Response, next) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  Logger.info(`${FACEBOOK_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
  passport.authenticate('facebook')(req, res, next);
});

// Callback handler
facebookRouter.get('/callback', passport.authenticate('facebook', { session: false }), async (req, res) => {
  // #swagger.tags = ['OAuth']
  // #swagger.ignore = true
  try {
    const accessTokenId = uuidv4();
    memoryStoreToken.set(accessTokenId, req.user.accessToken);
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&app=${FACEBOOK_APP}`;
    Logger.info(`${FACEBOOK_APP}: Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`${FACEBOOK_APP}: Error during callback: ${error.message}`);
    res.status(500).json({ app: FACEBOOK_APP, message: 'Error during callback' });
  }
});

// Send Event to Iframe
facebookRouter.post(
  '/event',
  hasValidEventHeader,
  hasValidAccessTokenHeader,
  isProfileMapEmpty,
  async (req: Request, res: Response) => {
    // #swagger.tags = ['OAuth']
    try {
      Logger.info(`${FACEBOOK_APP}: Request body tokenUUID ${req?.accessTokenID}`);
      Logger.info(`${FACEBOOK_APP}: Request body sseUUID ${req?.sseID}`);
      const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
      serverSentEventResponse.write(
        `data: {"message":"received", "app":"${FACEBOOK_APP}", "auth":"${req?.accessTokenID}"}\n\n`,
      );
      Logger.info(`${FACEBOOK_APP}: Server Side Event has been sent successfully`);
      memoryStoreSSE.delete(req?.sseID);
      return res.status(200).json({ app: FACEBOOK_APP, message: 'success' });
    } catch (error) {
      Logger.info(`${FACEBOOK_APP}: Error in sending SSE ${error.message}`);
      return res.status(500).json({ app: FACEBOOK_APP, message: 'Internal Server error' });
    }
  },
);

// Return User Object
facebookRouter.get('/info', hasValidAccessTokenHeader, isAuthenticated, isProfileMapEmpty, async (req, res) => {
  // #swagger.tags = ['OAuth']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  try {
    Logger.info(`${FACEBOOK_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
    const accessToken = memoryStoreToken.get(req.accessTokenID);
    let fbUser = { data: { data: {} } };
    if (accessToken) {
      try {
        fbUser = await axios.get(
          `https://graph.facebook.com/v20.0/me?fields=id,name,email,languages,location,feed{description,message},likes{about,bio,category},music{about,bio,category,name},posts{caption,description,message},favorite_athletes,friends,favorite_teams&access_token=${accessToken}`,
          {
            headers: {
              'Content-Type': 'application/json', // eslint-disable-line
            },
            timeout: 20000,
          },
        );
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${FACEBOOK_APP}: An error occurred: ${error.message}`);
        }
      }

      const moreFeedData = await getPagingData(fbUser?.data?.feed?.paging?.next);
      const moreLikesData = await getPagingData(fbUser?.data?.likes?.paging?.next);
      const moreMusicData = await getPagingData(fbUser?.data?.music?.paging?.next);

      fbUser?.data?.feed?.data = fbUser?.data?.feed?.data?.concat(moreFeedData);
      fbUser?.data?.likes?.data = fbUser?.data?.likes?.data?.concat(moreLikesData);
      fbUser?.data?.music?.data = fbUser?.data?.music?.data?.concat(moreMusicData);

      const facebookProfile = new FacebookProfile(fbUser?.data);
      const feed = sanitizeObject(facebookProfile?.feed);
      const favoriteAthletes = sanitizeObject(facebookProfile?.favoriteAthletes);
      const favoriteTeams = sanitizeObject(facebookProfile?.favoriteTeams);
      const favoriteMusic = sanitizeObject(facebookProfile?.music);
      const likes = sanitizeObject(facebookProfile?.likes);

      const feedContent = extractContent(feed);
      const favoriteAthletesContent = extractContent(favoriteAthletes);
      const favoriteTeamsContent = extractContent(favoriteTeams);
      const favoriteMusicContent = extractContent(favoriteMusic);
      const likesContent = extractContent(likes);

      const prompt1 = createPrompt(FACEBOOK_FETCH_INTEREST_PROMPT, feedContent + '\n' + likesContent);
      const prompt2 = createPrompt(
        FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT,
        favoriteAthletesContent + '\n' + favoriteTeamsContent + '\n' + favoriteMusicContent,
      );
      const interests1 = feedContent + likesContent ? await analyze(prompt1) : [];
      const interests2 =
        favoriteAthletesContent + favoriteTeamsContent + favoriteMusicContent ? await analyze(prompt2) : [];

      facebookProfile.feed = feed;
      facebookProfile.favoriteAthletes = favoriteAthletes;
      facebookProfile.favoriteTeams = favoriteTeams;
      facebookProfile.music = favoriteMusic;
      facebookProfile.likes = likes;
      facebookProfile.interests = interests1?.Interests?.concat(interests2?.Interests);
      facebookProfile.reputationScore = calculateReputation(facebookProfile);

      // Create User Profile Objects
      const smartProfile = new SmartProfile();
      smartProfile.username = facebookProfile?.name;
      smartProfile.privateData.attestedCred.interests = facebookProfile?.interests;
      smartProfile.scores.push({
        scoreType: ScoreTypes.reputationScore,
        scoreValue: facebookProfile?.reputationScore,
      });
      const counts = [{ field: 'friends count', value: facebookProfile?.friendsCount }, 
      { field: 'likes count', value: facebookProfile?.likesCount },
      { field: 'music count', value: facebookProfile?.musicCount },
      { field: 'athleast count', value: facebookProfile?.athletesCount },
      { field: 'favourite team count', value: facebookProfile?.favTeamCount }]
      smartProfile.privateData.extendedPrivateData.push({field: "counts", value : JSON.stringify(counts)});
      if (!memoryStoreProfile.get(req?.user?.uniqueSessionId)) {
        smartProfile.privateData.attestedPlatformIds.connectedProfiles = [
          { platformType: FACEBOOK_APP, userPlatformId: '', username: facebookProfile?.name },
        ];
        memoryStoreProfile.set(req?.user?.uniqueSessionId, smartProfile);
        memoryStoreToken.delete(req?.accessTokenID);
        Logger.info(`${FACEBOOK_APP}: User information has been delivered successfully`);
        return res.status(200).json({ app: FACEBOOK_APP, message: 'success' });
      } else {
        Logger.error(`${FACEBOOK_APP}: A profile already exists`);
        return res.status(500).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: INTERNAL_SERVER_ERROR });
      }
    } else {
      Logger.error(`${FACEBOOK_APP}: Token has been expired.`);
      return res.status(500).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: INTERNAL_SERVER_ERROR });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
      return res.status(408).json({ app: FACEBOOK_APP, message: TIMEOUT_ERROR });
    } else {
      Logger.error(`${FACEBOOK_APP}: Error occurred in fetching user informantion: ${error.message}`);
      return res.status(500).json({ app: FACEBOOK_APP, message: INTERNAL_SERVER_ERROR });
    }
  }
});
