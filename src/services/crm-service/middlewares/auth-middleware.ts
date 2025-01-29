import crypto from 'crypto';
import { AppDataSource } from '../../../data-source';
import * as dotenv from 'dotenv';
import { ClientApp } from '../entity/client-app';
import { Request, Response, NextFunction } from 'express';
import Logger from '../../../lib/logger';
import { ClientAppDev } from '../entity/client_app_dev';
import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';

dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientAppDev);

const stytchClient = new stytch.Client({
  project_id: 'project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29',
  secret: 'secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=',
});


// Middleware to authenticate client secret
export const isClientAppAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.headers['x-client-id'];
  const clientSecret = req.headers['x-client-secret'] || '';

  // clientId and secret should not be empty
  if (!clientId || !clientSecret || typeof clientId !== 'string' || typeof clientSecret !== 'string') {
    Logger.error('clientID and ClientSecret not find properly');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const client = await clientAppRepository.findOne({
    where: {
      id: clientId,
    },
  });
  if (!client) {
    return res.status(401).json({ error: 'Invalid Client ID' });
  }
  // verify secret
  const hashedSecret = crypto.createHash('sha256').update(clientSecret).digest('hex');
  if (hashedSecret !== client?.clientSecret) {
    return res.status(401).json({ error: 'Invalid Client Secret' });
  }

  req.client = client;
  next();
};


export const verifyStytchJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the JWT with Stytch
    const { session } = await stytchClient.sessions.authenticate({
      session_jwt: token,
    });
    next();
    // Attach session and user to request object
    // req.session = session;
    // req.user = {
    //   user_id: session.user_id,
    //   // Add other user properties as needed
    // };
  } catch (error: any) {
    Logger.error("Stytch authentication error:", error);
    
    // Handle specific error types
    if (error.error_type === "jwt_expired") {
      return res.status(401).json({ message: "Session expired" });
    }
    
    return res.status(401).json({ message: "Invalid session token" });
  }
};