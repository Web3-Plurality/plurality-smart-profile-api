import { NextFunction, Request, Response } from 'express';
import { memoryStoreToken, memoryStoreSSE, memoryStoreProfile } from '../../../utils/global';
import Logger from '../../../lib/logger';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

export function hasValidAccessTokenHeader(req: Request, res: Response, next: NextFunction) {
  const accessTokenID = req.headers['x-token-id'] as string | undefined;
  if (accessTokenID) {
    const accessToken = memoryStoreToken.get(accessTokenID);
    if (!accessToken) {
      Logger.error('Access token not found');
      return res.status(400).send('Access token not found');
    }
  } else {
    Logger.error('Invalid token id');
    return res.status(400).send('Invalid token id');
  }
  req.accessTokenID = accessTokenID;
  return next();
}

export function hasValidEventHeader(req: Request, res: Response, next: NextFunction) {
  const sseID = req.headers['x-sse-id'] as string | undefined;
  if (sseID) {
    const ssEvent = memoryStoreSSE.get(sseID);
    if (!ssEvent) {
      Logger.error('SSE event not found');
      return res.status(400).send('SSE event not found');
    }
  } else {
    Logger.error('Invalid event id');
    return res.status(400).send('Invalid event id');
  }
  req.sseID = sseID;
  return next();
}

export function hasValidEventParam(req: Request, res: Response, next: NextFunction) {
  const sseID = req?.query?.sse_id as string | undefined;
  if (sseID) {
    const ssEvent = memoryStoreSSE.get(sseID);
    if (!ssEvent) {
      Logger.error('SSE event not found');
      return res.status(400).send('SSE event not found');
    }
  } else {
    Logger.error('Invalid event id');
    return res.status(400).send('Invalid event id');
  }
  req.sseID = sseID;
  return next();
}

export const isProfileMapEmpty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = memoryStoreProfile.get(req?.user?.uniqueSessionId);
    const currentTime = new Date().getTime();
    if (profile && (currentTime - profile?.time) / 1000 < 60) {
      Logger.error(`A profile is already stored in memory can not proceed to connect more profiles`);
      return res.status(400).send('A profile is already stored in memory');
    } else {
      return next();
    }
  } catch (error: any) {
    Logger.error(`error: ${error}`);
    return res.status(400).send('Invalid request');
  }
};

export const isValidAddress = async (req: Request, res: Response, next: NextFunction) => {
  ethers.isAddress(req?.body?.address) ? next() : res.status(400).send('Invalid address');
};
