import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';
import express, { Request, Response } from 'express';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { LoginType, User } from '../../user-service/entity/user';
import jwt from 'jsonwebtoken';
import { AddUserClientMap } from '../utils/user';
import * as dotenv from 'dotenv';

dotenv.config();
export const authOTPRouter = express.Router();
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
const stytchClient = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID || '',
  secret: process.env.STYTCH_SECRET || '',
});
/* eslint-enable */

// Start the authentication flow
authOTPRouter.post('/login', async function (req: Request, res: Response) {
  // #swagger.tags = ['Auth']
  try {
    const email: string = req.body.email;
    const templateId = process.env.TEMPLATE_ID || '';
    /* eslint-disable */
    const options: OTPsEmailLoginOrCreateRequest = {
      email: email,
      login_template_id: templateId,
      expiration_minutes: 2,
    };
    /* eslint-enable */

    const existingUser = await userRepository.findOne({
      where: {
        email: req.body.email,
      },
    });
    if (existingUser) {
      if (!existingUser?.loginType) {
        Logger.info(`user ${existingUser.id} does not have login type, updating login type to stytch`);
        await userRepository.update(existingUser.id, { loginType: LoginType.stytch });
      } else if (existingUser.loginType !== LoginType.stytch && existingUser.loginType === LoginType.google) {
        Logger.error(`user ${existingUser.id} is not authorized to login with stytch`);
        return res.status(200).json({
          redirectToGoogle: true,
          message: `Redirecting you to Login with Google`,
        });
      }
    }

    const resp = await stytchClient.otps.email.loginOrCreate(options);
    Logger.info('OTP sent successfully');
    res.status(200).json({ success: true, message: 'OTP sent successfully', emailId: resp?.email_id });
  } catch (err) {
    console.error(err);
    res.status(400).send('Authentication failed');
  }
});

// Complete the authentication flow which mints the session
// parameters : code, email_id, address, subscribe, clientAppId
authOTPRouter.post('/authenticate', async function (req: Request, res: Response) {
  // #swagger.tags = ['Auth']
  try {
    let addedUser: User = new User();
    /* eslint-disable */
    const { code, email_id, subscribe, clientAppId } = req.body;
    const params: OTPsAuthenticateRequest = {
      code: code,
      session_duration_minutes: 60,
      method_id: email_id,
    };
    /* eslint-enable */

    // stytch authenticate
    const resp = await stytchClient.otps.authenticate(params);
    Logger.info('stytch Authenticated successfully');
    // Check if the user with the given email already exists
    const email = resp?.user?.emails[0]?.email;
    const existingUser = await userRepository.findOne({
      where: {
        email: email,
      },
    });
    if (existingUser) {
      Logger.info(`This user already exists!`);
    } else {
      // If the user doesn't exist, insert a new row
      Logger.info(`The user with this email was not found`);
      const newUser = await userRepository.create({
        email: email,
        subscribe: req?.body?.subscribe,
        loginType: LoginType.stytch,
      });
      addedUser = await userRepository.save(newUser);
      Logger.info(`new user created successfully with id ${addedUser?.id}`);
    }

    //if client id exist then add in user client map
    if (clientAppId) {
      const uniqueSessionId = await AddUserClientMap(existingUser?.id ? existingUser?.id : addedUser?.id, clientAppId);
      Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);
      const token = jwt.sign(
        { id: existingUser?.id ? existingUser?.id : addedUser?.id, uniqueSessionId },
        process.env.JWT_SECRET || '',
        { expiresIn: '1d' },
      );
      return res.status(200).json({
        success: true,
        token: token,
        stytchToken: resp?.session_jwt,
        user: existingUser?.id ? existingUser : addedUser,
        userId: resp?.user_id,
      });
    } else {
      Logger.error(`Client id not found`);
      throw new Error('Client id not found');
    }
  } catch (err) {
    console.error(err);
    res.status(401).send('Authentication failed');
  }
});
