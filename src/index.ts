import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from "cors";
import helmet from "helmet";
import * as dotenv from 'dotenv';
import { robloxRouter } from './controllers/OAuthRobloxController';
import { twitterRouter } from './controllers/OAuthTwitterController';

import session from 'express-session';
import passport from "passport";
import swaggerUi from "swagger-ui-express";
import * as swaggerDocument from "./swagger.json";
import { permawebRouter } from './controllers/PermawebUploadController';
import { tiktokRouter } from './controllers/OAuthTikTokController';
import { subgraphRouter } from './controllers/SubgraphController';
import https from "https"
import { stytchRouter } from './controllers/StytchController';
import { AppDataSource } from './data-source';
import fs from "fs";
import { initSSE } from './middlewares/authMiddleware';
import { snapchatRouter } from './controllers/OAuthSnapChatController';
import { instagramRouter } from './controllers/OAuthInstagramController';
import { facebookRouter } from './controllers/OAuthFacebookController';


dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(passport.initialize());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true, cookie: { secure: true, sameSite: 'none', httpOnly: true } }));
app.use(passport.session());
app.use("/oauth-twitter", twitterRouter);
app.use("/oauth-snapchat", snapchatRouter);
app.use("/oauth-roblox", robloxRouter);
app.use("/oauth-facebook", facebookRouter);
app.use("/oauth-instagram", instagramRouter);
app.use("/permaweb", permawebRouter);
app.use("/oauth-tiktok", tiktokRouter);
app.use("/subgraph", subgraphRouter);
app.use("/stytch", stytchRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).send({
    message: 'Hello World!',
  });
});

app.post('/post', async (req: Request, res: Response): Promise<Response> => {
  console.log(req.body);
  return res.status(200).send({
    message: 'Hello World from post!',
  });
});

// app.get('/register', async (req: Request, res: Response) => {
//   console.log("register endpoint", req.sessionID)
//   req.session.save(() => {
//     return res.status(200).json({ "message": "register" });
//   });
// });

app.get('/register-event', async (req: Request, res: Response) => {
  //const connection = activeConnections.get(req.sessionID);
  console.log(">>>>", req.sessionID)
  // if (!connection) {
    req.session.save(() => {
    initSSE(req, res);
  });
  // } else {
  //   return res.status(400).json({ "message": "SSE connection already exists." });
  // }
});

try {
  // Only for development 
  if (process.env.NODE_ENV==='development') {
    const options = {
      key: fs.readFileSync('./local-certificates/key.pem'),
      cert: fs.readFileSync('./local-certificates/cert.pem')
    };
    AppDataSource.initialize().then(async () => {
      https.createServer(options, app).listen(PORT, () => {
        console.log(`Server is running on https://app.plurality.local:${PORT}`);
      });
    }).catch((error) => console.log(error));
  }
  // Only for production 
  else {
    console.log(process.env.VERIFIER_UI_URL);
    app.set('trust proxy', 1);
    AppDataSource.initialize().then(async () => {  
      app.listen(PORT, (): void => {
        console.log(`Connected successfully on http port ${PORT}`);
        });
    }).catch((error) => console.log(error));
  }
} catch (error: any) {
  console.error(`Error occurred: ${error.message}`);
}
