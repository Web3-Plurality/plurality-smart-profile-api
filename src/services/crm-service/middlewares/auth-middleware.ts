import crypto from 'crypto';
import { AppDataSource } from '../../../data-source';
import * as dotenv from 'dotenv';
import { ClientApp } from '../entity/client-app';
import { Request, Response, NextFunction } from 'express';
import Logger from '../../../lib/logger';

dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);

// Middleware to authenticate client secret
export const isClientAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
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
