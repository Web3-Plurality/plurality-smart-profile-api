import crypto from 'crypto';
import { AppDataSource } from '../../../data-source';
import * as dotenv from 'dotenv';
import { ClientApp } from '../entity/client-app';
import { Request, Response, NextFunction } from 'express';
import Logger from '../../../lib/logger';
import stytch from 'stytch';

dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);
/* eslint-disable */
const stytchClient = new stytch.Client({
  project_id: 'project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29',
  secret: 'secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=',
});
/* eslint-ensable */

// Middleware to authenticate client secret
export const isClientAppAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const clientAppId = req.headers['x-client-app-id'];
  const clientSecret = req.headers['x-client-secret'] || '';

  // clientId and secret should not be empty
  if (!clientAppId || !clientSecret || typeof clientAppId !== 'string' || typeof clientSecret !== 'string') {
    Logger.error('clientAppID and ClientSecret not find properly');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const clientApp = await clientAppRepository.findOne({
    where: {
      id: clientAppId,
    },
  });
  if (!clientApp) {
    return res.status(401).json({ error: 'Invalid Client ID' });
  }
  // verify secret
  const hashedSecret = crypto.createHash('sha256').update(clientSecret).digest('hex');
  if (hashedSecret !== clientApp?.clientSecret) {
    return res.status(401).json({ error: 'Invalid Client Secret' });
  }

  req.clientApp = clientApp;
  next();
};

export const verifyStytchJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT with Stytch
    /* eslint-disable */
    const { session } = await stytchClient.sessions.authenticate({
      session_jwt: token,
    });
    /* eslint-enable */
    req.email = session?.authentication_factors[0]?.email_factor?.email_address || '';
    next();
    // Attach session and user to request object
    // req.session = session;
  } catch (error: any) {
    Logger.error('Stytch authentication error:', error);

    // Handle specific error types
    if (error.error_type === 'jwt_expired') {
      return res.status(401).json({ message: 'Session expired' });
    }

    return res.status(401).json({ message: 'Invalid session token' });
  }
};
