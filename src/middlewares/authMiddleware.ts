import { Request, Response } from "express";
import { memoryStore } from "../utils/global";
import Logger from "../lib/logger";
import jwt from 'jsonwebtoken';
import stytch from "stytch";
import * as dotenv from 'dotenv';
import { ethers } from "ethers";
import { SiweMessage } from 'siwe';

dotenv.config();

const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
  // env: stytch.envs.test,
});


export function hasValidAccessTokenHeader(req: Request, res: Response, next) {
  const accessTokenID = req.headers['x-token-id'];
  if (accessTokenID) {
    const accessToken = memoryStore.get(accessTokenID);
    if (!accessToken) {
      Logger.error("Access token not found");
      return res.status(400).send("Access token not found");
    }
  }
  else {
    Logger.error("Invalid token id");
    return res.status(400).send("Invalid token id");
  }
  req.accessTokenID = accessTokenID;
  return next();
}

export function hasValidEventHeader(req: Request, res: Response, next) {
  const sseID = req.headers['x-sse-id'];
  if (sseID) {
    const ssEvent = memoryStore.get(sseID);
    if (!ssEvent) {
      Logger.error("SSE event not found");
      return res.status(400).send("SSE event not found");
    }
  }
  else {
    Logger.error("Invalid event id");
    return res.status(400).send("Invalid event id");
  }
  req.sseID = sseID;
  return next();
}

export function hasValidEventParam(req: Request, res: Response, next) {
  const sseID = req.query.sse_id;
  if (sseID) {
    const ssEvent = memoryStore.get(sseID);
    if (!ssEvent) {
      Logger.error("SSE event not found");
      return res.status(400).send("SSE event not found");
    }
  }
  else {
    Logger.error("Invalid event id");
    return res.status(400).send("Invalid event id");
  }
  req.sseID = sseID;
  return next();
}
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


  const stytchToken = req.headers['x-stytch-token'];
  const signature = req.headers['x-signature'];
  if (stytchToken && signature) {
    Logger.error("get both address signature and email session token at the same time")
    return res.status(500).json({ errors: "internal server error" });
  }

  if (stytchToken) {
    // email varification
    const stytchSession = await client.sessions.authenticateJwt({
      session_jwt: stytchToken,
    })
    // stytchSession?.authentication_factors?.
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
    delete req?.body?.data["address"]; // if we are validating it with email then we have to create token with email
    return next();
  }

  if (signature) {
    try {
      //address varification
      const nonce = memoryStore[req?.body?.data?.address];
      if (!nonce) {
        Logger.error(`Invalid nonce`);
        return res.status(400).send('Invalid nonce');
      }

      // new implementation
      const { message } = req?.body?.data;
      const siweMessage = new SiweMessage(message);
      await siweMessage.verify({ signature })
      if (siweMessage?.address?.toLowerCase() !== req?.body?.data?.address?.toLowerCase()) {
        Logger.error(`Invalid signature`);
        return res.status(400).send('Invalid signature');
      }

      if (req?.body?.data["email"]) {
        delete req?.body?.data["email"];
      }
      delete memoryStore[req?.body?.data?.address]; // Optionally delete the used challenge
      return next()
    }
    catch (e) {
      Logger.error(`Invalid signature: ${e}`);
      return res.status(400).send('Invalid signature');
    }
  }
  Logger.error(`neighter stytch token nor signature found`);
  return res.status(400).send('Invalid request');
};