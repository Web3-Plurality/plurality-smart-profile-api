import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';
import express from 'express';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { LoginType, User } from '../entity/user';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { AddUserClientMap } from '../utils/user';
import * as dotenv from 'dotenv';

dotenv.config();
export const authOTPRouter = express.Router();
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
const stytchClient = new stytch.Client({
  project_id: 'project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29',
  secret: 'secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=',
});
/* eslint-enable */

// Start the authentication flow
authOTPRouter.post('/login', async function (req, res) {
  // #swagger.tags = ['Users']
  try {
    const email: string = req.body.email;
    const templateId = 'sign_in_to_plurality_network';
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
// parameters : code, email_id, address, subscribe, clientId
authOTPRouter.post('/authenticate', async function (req, res) {
  // #swagger.tags = ['Users']
  try {
    let token = '';
    let addedUser = {};
    const uniqueSessionId = uuidv4();
    /* eslint-disable */
    const { code, email_id, subscribe, clientId } = req.body;
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
    console.log(resp);
    const email = resp?.user?.emails[0]?.email;
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
        subscribe: req?.body?.subscribe,
        loginType: LoginType.stytch,
      });
      addedUser = await userRepository.save(newUser);
      Logger.info(`new user created successfully with id ${addedUser?.id}`);
      token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    }

    //if client id exist then add in user client map
    if (clientId) {
      await AddUserClientMap(existingUser?.id ? existingUser?.id : addedUser?.id, clientId);
    } else {
      Logger.error(`Client id not found`);
      throw new Error('Client id not found');
    }

    Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);
    return res.status(200).json({
      success: true,
      pluralityToken: token,
      stytchToken: resp?.session_jwt,
      user: existingUser?.id ? existingUser : addedUser,
      userId: resp?.user_id,
    });
  } catch (err) {
    console.error(err);
    res.status(401).send('Authentication failed');
  }
});
