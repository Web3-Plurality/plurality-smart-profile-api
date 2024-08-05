import { Request, Response } from "express";
import { activeConnections } from "../utils/global";
import Logger from "../lib/logger";

export function isAuthenticated(req: Request, res: Response, next) {
    if (req?.sessionID && req?.session?.user?.accessToken) {
      // User is authenticated
      return next();
    }
    // User is not authenticated
    Logger.error("You need to log in.");
    res.status(401).send("You need to log in.");
  }
  
  export function isConnected(req: Request, res: Response, next) {
    const connection = activeConnections.get(req.sessionID);
    if (!connection) {
      Logger.error("Register Event first");
      return res.status(400).send("Register Event first");
    }
    return next();
  }
  
  export function initSSE(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: {"message":"Connection established"}\n\n`);
    activeConnections.set(req.sessionID, res);
  }