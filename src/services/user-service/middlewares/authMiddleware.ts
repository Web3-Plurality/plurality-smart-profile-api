import { memoryStoreNonce } from "../../../utils/global";
import Logger from "../../../lib/logger";
import jwt from 'jsonwebtoken';
import stytch from "stytch";
import * as dotenv from 'dotenv';
import { SiweMessage } from 'siwe';
import { ethers } from "ethers";

dotenv.config();
const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
  // env: stytch.envs.test,
});

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

export const isValid = async (req, res, next) => {
  try {
  const stytchToken = req.headers['x-stytch-token'];
  const siweObj = req.headers['x-siwe']? JSON.parse(req.headers['x-siwe']):'';
  const siweToken = siweObj?.siwe;
  
  if (stytchToken && siweToken) {
    Logger.error("get both siwe token and email session token at the same time")
    return res.status(500).json({ errors: "internal server error" });
  }
  // email varification
  if (stytchToken && req?.body?.data["email"] && req?.body?.data["address"]) {
    try {
      const stytchSession = await client.sessions.authenticateJwt({
      session_jwt: stytchToken,
      })
      if (stytchSession?.session?.authentication_factors[0]?.email_factor?.email_address !== req?.body?.data?.email) {
        Logger.error(`Invalid stytch token`);
        return res.status(401).json({ errors: "Invalid stytch token" });
      }
      if (jwt.decode(stytchToken)?.exp < Math.floor(Date.now() / 1000)) {
        Logger.error(`stytch token expired`);
        return res.status(401).json({ errors: "stytch token expired" });
      }
      if (jwt.decode(stytchToken)?.aud[0] !== process.env.STYTCH_PROJECT_ID) {
        Logger.error(`stytch token not belongs to this project`);
        return res.status(401).json({ errors: "stytch token expired" });
      }      
      } catch (error) {
        Logger.error(`Invalid stytch token: ${error}`);
        return res.status(400).send('Invalid stytch token');
      }
      return next();
  }
  else if (siweToken && req?.body?.data["address"] && !req?.body?.data["email"]) {
    try {
      //address varification
      const message = decodeURIComponent(siweObj?.message);
      const nonce = memoryStoreNonce.get(req?.body?.data?.address);
      if (!nonce) {
        Logger.error(`Invalid nonce`);
        return res.status(400).send('Invalid nonce');
      }
      delete memoryStoreNonce[req?.body?.data?.address];
      const siweMessage = new SiweMessage(message); 
      const signature=siweToken;
      const siweResponse = await siweMessage.verify({ signature })
      if (!siweResponse.success) {
        Logger.error(`Invalid siwe token`);
        return res.status(400).send('Invalid siwe token');
      }
      if (siweMessage?.address?.toLowerCase() !== req?.body?.data?.address?.toLowerCase()) {
        Logger.error(`Invalid siwe token`);
        return res.status(400).send('Invalid siwe token');
      }
      return next()
    }
    catch (e) {
      Logger.error(`Invalid siwe token: ${e}`);
      return res.status(400).send('Invalid siwe token');
    }
  }
  else{
    Logger.error(`neither stytch token nor siwe token found`);
    return res.status(400).send('Invalid request');
  }
} catch (error) {
  Logger.error(`error: ${error}`);
  return res.status(400).send('Invalid request');
}
};



export const isValidAddress = async (req, res, next) => {
  ethers.isAddress(req?.body?.data?.address) ? next() : res.status(400).send('Invalid address');
}