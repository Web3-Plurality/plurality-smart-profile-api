import { Request, Response } from "express";
import { memoryStore } from "../utils/global";
import Logger from "../lib/logger";

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