import express, { Request, Response } from 'express';
import { AppDataSource } from '../../../data-source';
import Logger from '../../../lib/logger';
import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';
import { Client } from '../entity/client';
import { verifyStytchJWT } from '../middlewares/auth-middleware';

export const clientRouter = express.Router();

const clientRepository = AppDataSource.getRepository(Client);
/* eslint-disable */
const stytchClient = new stytch.Client({
  project_id: 'project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29',
  secret: 'secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=',
});

const templateId = process.env.CLIENT_OTP_TEMPLATE_ID || '';

clientRouter.post('/login', async function (req: Request, res: Response) {
  // #swagger.tags = ['Auth']
  try {
    const email: string = req.body.email;
    /* eslint-disable */
    const options: OTPsEmailLoginOrCreateRequest = {
      email: email,
      login_template_id: templateId,
      expiration_minutes: 2,
    };
    /* eslint-enable */

    const resp = await stytchClient.otps.email.loginOrCreate(options);
    Logger.info('OTP sent successfully');
    res.status(200).json({ success: true, message: 'OTP sent successfully', emailId: resp?.email_id });
  } catch (err) {
    console.error(err);
    res.status(400).send('Authentication failed');
  }
});

clientRouter.post('/authenticate', async function (req: Request, res: Response) {
  // #swagger.tags = ['Auth']
  try {
    //   let addedUser: User = new User();
    /* eslint-disable */
    const { code, emailId, projectName, projectWebsite } = req.body;

    const params: OTPsAuthenticateRequest = {
      code: code,
      session_duration_minutes: 60,
      method_id: emailId,
    };
    /* eslint-enable */

    // stytch authenticate
    const resp = await stytchClient.otps.authenticate(params);
    Logger.info('stytch Authenticated successfully');
    // Check if the user with the given email already exists
    const email = resp?.user?.emails[0]?.email;

    const existingClient = await clientRepository.findOne({
      where: {
        email: email,
      },
    });

    if (existingClient) {
      return res.status(200).json({
        success: true,
        stytchToken: resp?.session_jwt,
        client: existingClient,
      });
    }
    const newClient = await clientRepository.create({
      projectName,
      email,
      projectWebsite,
    });

    await clientRepository.save(newClient);

    return res.status(200).json({
      success: true,
      stytchToken: resp?.session_jwt,
      client: newClient,
    });
  } catch (err) {
    console.error(err);
    res.status(401).send('Authentication failed');
  }
});


clientRouter.get('/', verifyStytchJWT, async (req: Request, res: Response) => {
  // #swagger.tags = ['Client App']
  try {
    const email = req.email;
    const data: any = await clientRepository.find({
      where: {
        email: email,
      },
      relations: ['apps'],
    });

    return res.status(200).json({ client: data[0] });
  } catch (error) {}
});