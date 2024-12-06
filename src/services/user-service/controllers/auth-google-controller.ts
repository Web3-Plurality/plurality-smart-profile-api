import * as dotenv from 'dotenv';
import express from 'express';
import GoogleStrategy from 'passport-google-oauth20';
import passport from 'passport';
import { Request, Response } from 'groq-sdk/_shims/auto/types';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { LoginType, User } from '../entity/user';
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
import stytch, { OTPsEmailLoginOrCreateRequest } from 'stytch';

dotenv.config();
export const authGoogleRouter = express.Router();

const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
const stytchClient = new stytch.Client({
  project_id: 'project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29',
  secret: 'secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=',
});

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
  // #swagger.tags = ['Users']
  Logger.info(`${GOOGLE_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
  passport.authenticate('google', { scope: ['email'] })(req, res, next);
});

authGoogleRouter.get('/callback', passport.authenticate('google', { session: false }), async (req, res) => {
  // #swagger.tags = ['Users']
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
      if (!existingUser.loginType) {
        Logger.info(`user ${existingUser.id} does not have login type, updating login type to google`);
        await userRepository.update(existingUser.id, { loginType: LoginType.google });
      } else if (existingUser.loginType !== LoginType.google && existingUser.loginType === LoginType.stytch) {
        Logger.info(`user ${existingUser.id} is not authorized to login with google`);
        const templateId = 'sign_in_to_plurality_network';
        /* eslint-disable */
        const options: OTPsEmailLoginOrCreateRequest = {
          email: existingUser?.email,
          login_template_id: templateId,
          expiration_minutes: 2,
        };
        /* eslint-enable */
        const resp = await stytchClient.otps.email.loginOrCreate(options);
        memoryStoreToken.set(accessTokenId, resp?.email_id);
        Logger.info('OTP sent successfully');
        const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&redirect=${true}`;
        Logger.info(`Redirecting to ${url}`);
        return res.redirect(url);
      }
    } else {
      // If the user doesn't exist, insert a new row
      Logger.info(`The user with this email was not found`);
      const newUser = await userRepository.create({
        email: email,
        loginType: LoginType.google,
      });
      addedUser = await userRepository.save(newUser);
      Logger.info(`new user created successfully with id ${addedUser?.id}`);
      token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    }

    Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);
    memoryStoreToken.set(accessTokenId, { googleJwtToken: req?.user?.googleJwtToken, pluralityToken: token });
    const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&redirect=${false}`;

    Logger.info(`Redirecting to ${url}`);
    res.redirect(url);
  } catch (error: any) {
    Logger.error(`Error during callback: ${error.message}`);
    res.status(500).json({ message: 'Error during callback' });
  }
});

authGoogleRouter.post('/event', hasValidEventHeader, hasValidAccessTokenHeader, async (req, res) => {
  // #swagger.tags = ['Users']
  try {
    Logger.info(`Request body tokenUUID ${req?.accessTokenID}`);
    Logger.info(`Request body sseUUID ${req?.sseID}`);
    const { redirect, clientId } = req.body;
    const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
    if (redirect) {
      const emailId = memoryStoreToken.get(req?.accessTokenID);
      serverSentEventResponse.write(`data: {"message":"received", "app":"google", "emailId":"${emailId}"}\n\n`);
      Logger.info(` Server Side Event has been sent successfully`);
      memoryStoreSSE.delete(req?.sseID);
      memoryStoreSSE.delete(req?.accessTokenID);
      return res.status(200).json({ message: 'success' });
    }
    const tokenObj = memoryStoreToken.get(req?.accessTokenID);
    serverSentEventResponse.write(
      `data: {"message":"received", "app":"google", "googleJwtToken":"${tokenObj?.googleJwtToken}", "pluralityToken": "${tokenObj?.pluralityToken}"}\n\n`,
    );
    Logger.info(` Server Side Event has been sent successfully`);
    memoryStoreSSE.delete(req?.sseID);
    memoryStoreSSE.delete(req?.accessTokenID);
    //if client id exist then add in user client map
    if (clientId) {
      console.log('clientId', clientId);
      await AddUserClientMap(jwt.decode(tokenObj?.pluralityToken)?.id, clientId);
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
