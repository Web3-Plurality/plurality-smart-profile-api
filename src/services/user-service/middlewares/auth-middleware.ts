import Logger from '../../../lib/logger';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { verifyPrivateAttestation, verifyPublicAttestation } from '../utils/plurality-attestation';
import { normalizeSmartProfile } from '../utils/smart-profile';

dotenv.config();
// const client = new stytch.Client({
//   project_id: process.env.STYTCH_PROJECT_ID,
//   secret: process.env.STYTCH_SECRET,
//   // env: stytch.envs.test,
// });

// Middleware to authenticate JWT
export const isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(401).send('Token is missing');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send('Invalid token');
    }
    req.user = user;
    next();
  });
};

export const isValidAddress = async (req, res, next) => {
  ethers.isAddress(req?.body?.data?.address) ? next() : res.status(400).send('Invalid address');
};

export const isValidAttestation = async (req, res, next) => {
  try {
    const smartProfile = normalizeSmartProfile(req?.body?.smartProfile);
    const isVerifiedPublicAttestaion = verifyPublicAttestation(smartProfile);
    const isVerifiedPrivateAttestaion = verifyPrivateAttestation(smartProfile.privateData);
    if (isVerifiedPublicAttestaion && isVerifiedPrivateAttestaion) {
      Logger.info('Attestation Checked');
      //req.smartProfile=smartProfile;
      return next();
    } else {
      Logger.error('Attestaion is not verified');
      return res.status(400).send('Attestaion is not valid');
    }
  } catch (error) {
    Logger.error(`error: ${error}`);
    return res.status(400).send('Invalid request');
  }
};
