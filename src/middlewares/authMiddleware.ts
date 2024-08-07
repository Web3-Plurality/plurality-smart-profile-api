import { Request, Response } from "express";
import { activeConnections } from "../utils/global";
import Logger from "../lib/logger";
import jwt from 'jsonwebtoken';
import { v4  as uuidv4 } from 'uuid';
// export function isAuthenticated(req: Request, res: Response, next) {
//     if (req?.sessionID && req?.session?.user?.accessToken) {
//       // User is authenticated
//       return next();
//     }
//     // User is not authenticated
//     Logger.error("You need to log in.");
//     res.status(401).send("You need to log in.");
//   }
  

  export function isAuthenticated(req: Request, res: Response, next) {


    // const authHeader = req.headers['authorization'];
    // const token = authHeader && authHeader.split(' ')[1];

    // Logger.error("You need to log in.");
    // if (token == null) return res.status(401).send("no access token found"); // If no token is provided

    // jwt.verify(token, 'your_jwt_secret', (err, user) => {
    //     if (err) return res.status(403).send("invalid token");  // If token is invalid
    //     req.user = user;
    //     next();
    // });



    const accessTokenID = req.headers['x-token-id'];
    const sseID = req.headers['x-sse-id'];


   
    if (!accessTokenID && !sseID) {
      Logger.error("You need to log in.");
      return res.status(401).send("no access token found"); // If no token is provided}
    }
    req.accessTokenID = accessTokenID;
    req.sseID = sseID;
    return next();


  }
 
  


  export function isConnected(req: Request, res: Response, next) {
    const sseID = req.query.sseID;
    const connection = activeConnections.get(sseID);
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
    // TODO: generate randomUUID (sseUUID) as the unique identifier instead of session ID and return the randomUUID in message
    // TODO: The FE would get this UUID and store it in localstorage
    const id = uuidv4();
console.log(id);
    res.write(`data: {"message":"Connection established", "id":"${id}"}\n\n`);
    activeConnections.set(id, res);
  }