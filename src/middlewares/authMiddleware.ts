import { Request, Response } from "express";
import { memoryStore } from "../utils/global";
import Logger from "../lib/logger";
import { v4 as uuidv4 } from 'uuid';

export function isAuthenticated(req: Request, res: Response, next) {
  const accessTokenID = req.headers['x-token-id'];
  const sseID = req.headers['x-sse-id'];
  console.log(req.headers)
  if (!accessTokenID && !sseID) {
    Logger.error("You need to log in.");
    return res.status(401).send("no access token found"); // If no token is provided}
  }
  req.accessTokenID = accessTokenID;
  req.sseID = sseID;
  return next();
}

export function isConnected(req: Request, res: Response, next) {
  const sseID = req.query.sse_id;
  const connection = memoryStore.get(sseID);
  if (!connection) {
    Logger.error("Register Event first");
    return res.status(400).send("Register Event first");
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
  const id = uuidv4();
  memoryStore.set(id, res);
  res.write(`data: {"message":"Connection established", "id":"${id}"}\n\n`);
}