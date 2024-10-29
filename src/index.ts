import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from "cors";
import helmet from "helmet";
import * as dotenv from 'dotenv';
import { robloxRouter } from './Oauth-service/controllers/OAuthRobloxController';
import { twitterRouter } from './Oauth-service/controllers/OAuthTwitterController';

import session from 'express-session';
import passport from "passport";
import swaggerUi from "swagger-ui-express";
import * as swaggerDocument from "./swagger.json";
import { permawebRouter } from './other-service/controllers/PermawebUploadController';
import { tiktokRouter } from './Oauth-service/controllers/OAuthTikTokController';
import { subgraphRouter } from './other-service/controllers/SubgraphController';
import https from "https"
import { userRouter } from './user-service/controllers/UserController';
import { AppDataSource } from './data-source';
import fs from "fs";
import { initSSE } from './utils/global';
import { snapchatRouter } from './Oauth-service/controllers/OAuthSnapChatController';
import { instagramRouter } from './Oauth-service/controllers/OAuthInstagramController';
import { facebookRouter } from './Oauth-service/controllers/OAuthFacebookController';
import { fortniteRouter } from './Oauth-service/controllers/OAuthFortniteController';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import { clientAppRouter } from './client-service/controllers/ClientAppController';
import { authOTPRouter } from './attestation-service/controllers/AuthOTPController';
import { authSiweRouter } from './attestation-service/controllers/AuthSiweController';

dotenv.config();

export const app: Application = express();
const PORT = process.env.PORT;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true }));
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(passport.initialize());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.session());
app.use("/oauth-twitter", twitterRouter);
app.use("/oauth-snapchat", snapchatRouter);
app.use("/oauth-roblox", robloxRouter);
app.use("/oauth-facebook", facebookRouter);
app.use("/oauth-instagram", instagramRouter);
app.use("/oauth-fortnite", fortniteRouter);
app.use("/permaweb", permawebRouter);
app.use("/oauth-tiktok", tiktokRouter);
app.use("/subgraph", subgraphRouter);
app.use("/user", userRouter);
app.use("/auth/otp", authOTPRouter);
app.use("/auth/siwe", authSiweRouter);


app.use("/client-app", clientAppRouter); 
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

app.get('/register-event', async (req: Request, res: Response) => {
  initSSE(req, res)
});


try {

  app.locals.litNodeClient = new LitJsSdk.LitNodeClientNodeJs({
    // alertWhenUnauthorized: false,
    checkNodeAttestation: true,
    litNetwork: LitNetwork.Datil,
  });

  // Only for development 
  if (process.env.NODE_ENV === 'development') {
    const options = {
      key: fs.readFileSync('./local-certificates/key.pem'),
      cert: fs.readFileSync('./local-certificates/cert.pem')
    };
    AppDataSource.initialize().then(async () => {
      await app.locals.litNodeClient.connect();
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
      await app.locals.litNodeClient.connect();
      app.listen(PORT, (): void => {
        console.log(`Connected successfully on http port ${PORT}`);
      });
    }).catch((error) => console.log(error));
  }
} catch (error: any) {
  console.error(`Error occurred: ${error.message}`);
}
