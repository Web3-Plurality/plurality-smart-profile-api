import { Request, Response } from "express";
import { memoryStore } from "../utils/global";
import Logger from "../lib/logger";
import jwt from 'jsonwebtoken';


export function hasValidAccessTokenHeader(req: Request, res: Response, next) {
  const accessTokenID = req.headers['x-token-id'];
  if (accessTokenID)
  {
    const accessToken = memoryStore.get(accessTokenID);
    if (!accessToken) {
      Logger.error("Access token not found");
      return res.status(400).send("Access token not found");
    }
  }
  else 
  {
    Logger.error("Invalid token id");
    return res.status(400).send("Invalid token id");
  }
  req.accessTokenID = accessTokenID;
  return next();
}

export function hasValidEventHeader(req: Request, res: Response, next) {
  const sseID = req.headers['x-sse-id'];
  if (sseID)
  {
    const ssEvent = memoryStore.get(sseID);
    if (!ssEvent) {
      Logger.error("SSE event not found");
      return res.status(400).send("SSE event not found");
    }
  }
  else 
  {
    Logger.error("Invalid event id");
    return res.status(400).send("Invalid event id");
  }
  req.sseID = sseID;
  return next();
}

export function hasValidEventParam(req: Request, res: Response, next) {
  const sseID = req.query.sse_id;
  if (sseID)
  {
    const ssEvent = memoryStore.get(sseID);
    if (!ssEvent) {
      Logger.error("SSE event not found");
      return res.status(400).send("SSE event not found");
    }
  }
  else 
  {
    Logger.error("Invalid event id");
    return res.status(400).send("Invalid event id");
  }
  req.sseID = sseID;
  return next();
}
  
  export function initSSE(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: {"message":"Connection established"}\n\n`);
    memoryStore.set(req.sessionID, res);
  }


// Middleware to authenticate JWT
export const authenticateUser = (req, res, next) => {
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


// const authenticateStytchSession = (req, res, next) => {
//   return client.sessions.authenticate({
//     session_token: req.cookies['stytch_session'],
//   })
//     .then(session => {
//       req.stytchSession = session;
//       return next();
//     })
//     .catch(next)
// };