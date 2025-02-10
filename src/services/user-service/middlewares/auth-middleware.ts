import Logger from '../../../lib/logger';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { PluralityAttestation, normalizeSmartProfile } from '@plurality-network/smart-profile-utils';
import { User } from '../entity/user';
import { AppDataSource } from '../../../data-source';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ClientApp } from '../../crm-service/entity/client-app';

dotenv.config();

const clientAppRepository = AppDataSource.getRepository(ClientApp);

// Middleware to authenticate JWT
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(401).send('Token is missing');
  }

  jwt.verify(token, process.env.JWT_SECRET || '', (err, user: any) => {
    if (err) {
      return res.status(403).send('Invalid token');
    }
    req.user = user;
    next();
  });
};

export const isValidUserJwt = (req: Request, res: Response, next: NextFunction) => {
  const token = req?.body?.token;

  if (!token) {
    return res.status(401).send('Token is missing');
  }

  jwt.verify(token, process.env.JWT_SECRET || '', (err: any, user: any) => {
    if (err) {
      return res.status(403).send('Invalid token');
    }
    req.user = user;
    next();
  });
};

export const isValidAddress = async (req: Request, res: Response, next: NextFunction) => {
  ethers.isAddress(req?.body?.data?.address) ? next() : res.status(400).send('Invalid address');
};

export const isValidAttestation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluralityAttestation = new PluralityAttestation({
      signerPrivateKey: process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '',
      signerAddress: process.env.PUBLIC_DAPP_OWNER_WALLET_ADDRESS || '',
      easContractAddress: process.env.EAS_CONTRACT_ADDRESS || '',
      rpcProvider: process.env.EAS_BLOCKCHAIN_RPC || '',
    });
    const smartProfile = normalizeSmartProfile(req?.body?.smartProfile);
    const existingUser = await AppDataSource.getRepository(User).findOne({
      where: {
        id: req?.user?.id,
      },
    });
    const isVerifiedSmartProfileAttestaion = await pluralityAttestation.verifySmartProfileAttestation(
      smartProfile,
      existingUser?.pkpAddress || '',
    );
    if (isVerifiedSmartProfileAttestaion) {
      Logger.info('Attestation Checked');
      //req.smartProfile=smartProfile;
      return next();
    } else {
      Logger.error('Attestaion is not verified');
      return res.status(400).send('Attestaion is not valid');
    }
  } catch (error: any) {
    Logger.error(`error: ${error}`);
    return res.status(400).send('Invalid request');
  }
};

// Middleware to authenticate client secret
export const isClientAppAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader);
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [clientAppId, clientSecret] = credentials.split(':');
  console.log(clientAppId);
  console.log(clientSecret);

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
