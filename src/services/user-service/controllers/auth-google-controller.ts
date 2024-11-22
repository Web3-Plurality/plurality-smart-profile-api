import * as dotenv from 'dotenv';
import express from 'express';
import GoogleStrategy from 'passport-google-oauth20';
import passport from 'passport';
import { Request, Response } from 'groq-sdk/_shims/auto/types';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { memoryStoreSSE, memoryStoreToken } from '../../../utils/global';
import {
  hasValidAccessTokenHeader,
  hasValidEventHeader,
  hasValidEventParam,
} from '../../oauth-service/middlewares/oauth-middleware';
import { GOOGLE_APP } from '../../oauth-service/utils/constants';
import { AddUserClientMap } from '../utils/user';

dotenv.config();
export const authGoogleRouter = express.Router();

const userRepository = AppDataSource.getRepository(User);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    function (accessToken, refreshToken, params, profile, done) {
      return done('', { email: profile?._json?.email, googleJwtToken: params?.id_token });
    },
  ),
);

// Start the authentication flow
authGoogleRouter.get('/login', hasValidEventParam, async (req: Request, res: Response, next) => {
  Logger.info(`${GOOGLE_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
  passport.authenticate('google', { scope: ['email'] })(req, res, next);
});

authGoogleRouter.get('/callback', passport.authenticate('google', { session: false }), async (req, res) => {
  try {
    let token = '';
    let addedUser = {};
    const accessTokenId = uuidv4();
    const uniqueSessionId = uuidv4();
    const email = req?.user?.email;
    const existingUser = await userRepository.findOne({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      Logger.info(`This user already exists!`);
      token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    } else {
      // If the user doesn't exist, insert a new row
      Logger.info(`The user with this email was not found`);
      const newUser = await userRepository.create({
        email: email,
      });
      addedUser = await userRepository.save(newUser);
      Logger.info(`new user created successfully with id ${addedUser?.id}`);
      token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    }
    Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);

    memoryStoreToken.set(accessTokenId, { googleJwtToken: req?.user?.googleJwtToken, pluralityToken: token });
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}`;

    Logger.info(`Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`Error during callback: ${error.message}`);
    res.status(500).json({ message: 'Error during callback' });
  }
});

authGoogleRouter.post('/event', hasValidEventHeader, hasValidAccessTokenHeader, async (req, res) => {
  try {
    Logger.info(`Request body tokenUUID ${req?.accessTokenID}`);
    Logger.info(`Request body sseUUID ${req?.sseID}`);
    const tokenObj = memoryStoreToken.get(req?.accessTokenID);
    const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
    serverSentEventResponse.write(
      `data: {"message":"received", "app":"google", "googleJwtToken":"${tokenObj?.googleJwtToken}", "pluralityToken": "${tokenObj?.pluralityToken}"}\n\n`,
    );
    Logger.info(` Server Side Event has been sent successfully`);
    memoryStoreSSE.delete(req?.sseID);
    memoryStoreSSE.delete(req?.accessTokenID);
    //if client id exist then add in user client map
    if (req?.body?.clientId) {
      console.log('clientId', req?.body?.clientId);
      await AddUserClientMap(jwt.decode(tokenObj?.pluralityToken)?.id, req?.body?.clientId);
    } else {
      Logger.error(`Client id not found`);
      throw new Error('Client id not found');
    }
    return res.status(200).json({ message: 'success' });
  } catch (error) {
    Logger.info(`Error in sending SSE ${error.message}`);
    return res.status(500).json({ message: 'Internal Server error' });
  }
});
