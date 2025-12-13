import express, { Application } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
// import * as swaggerDocument from './swagger.json';
import * as swaggerDocumentForPluralityDashboard from './swagger-plurality.json';
import * as swaggerDocumentForDevDashboard from './swagger-developer.json';
import * as swaggerDocumentForClient from './swagger-client.json';

import https from 'https';
import { AppDataSource } from './data-source';
import fs from 'fs';
// auth service routers
import { authOTPRouter } from './services/auth-service/controllers/auth-otp-controller';
import { authSiweRouter } from './services/auth-service/controllers/auth-siwe-controller';
import { authGoogleRouter } from './services/auth-service/controllers/auth-google-controller';
// user service routers
import { smartProfileRouter } from './services/user-service/controllers/smart-profile-controller';
import { capacityRouter } from './services/user-service/controllers/capacity-controller';
// oauth service routers
import { robloxRouter } from './services/oauth-service/controllers/oauth-roblox-controller';
import { twitterRouter } from './services/oauth-service/controllers/oauth-twitter-controller';
import { tiktokRouter } from './services/oauth-service/controllers/oauth-tiktok-controller';
import { snapchatRouter } from './services/oauth-service/controllers/oauth-snapchat-controller';
import { instagramRouter } from './services/oauth-service/controllers/oauth-instagram-controller';
import { facebookRouter } from './services/oauth-service/controllers/oauth-facebook-controller';
import { fortniteRouter } from './services/oauth-service/controllers/oauth-fortnite-controller';
import { sseRouter } from './services/oauth-service/controllers/sse-controller';
// crm service routers
import { clientRouter } from './services/crm-service/controllers/client-controller';
import { clientAppRouter } from './services/crm-service/controllers/client-app-controller';
import { creditRouter } from './services/crm-service/controllers/credit-controller';
// orbis-map service routers
import { profileTypeRouter } from './services/orbis-map-service/controller/profile-type-controller';
import { smartProfileOrbisRouter } from './services/orbis-map-service/controller/smart-profile-controller';
// Lit SDK
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LitNetwork } from '@lit-protocol/constants';
import { userRouter } from './services/user-service/controllers/user-controller';

dotenv.config();

export const app: Application = express();
const PORT = process.env.PORT;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(passport.initialize());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.session());

// auth service routers
app.use('/auth/otp', authOTPRouter);
app.use('/auth/siwe', authSiweRouter);
app.use('/auth/google', authGoogleRouter);

// user service routers
app.use('/user/smart-profile', smartProfileRouter);
app.use('/user/capacity', capacityRouter);
app.use('/user', userRouter);
// oauth service routers
app.use('/oauth-twitter', twitterRouter);
app.use('/oauth-snapchat', snapchatRouter);
app.use('/oauth-roblox', robloxRouter);
app.use('/oauth-facebook', facebookRouter);
app.use('/oauth-instagram', instagramRouter);
app.use('/oauth-fortnite', fortniteRouter);
app.use('/oauth-tiktok', tiktokRouter);
app.use('/register-event', sseRouter);

// crm service router
app.use('/crm/client-app', clientAppRouter);
app.use('/crm/client', clientRouter);
app.use('/crm/credits', creditRouter);

// orbis-map service router
app.use('/orbis-map/profile-types', profileTypeRouter);
app.use('/orbis-map/smart-profiles', smartProfileOrbisRouter);

// swagger router
app.use('/docs-wallet', swaggerUi.serve, (req: any, res: any, next: any) =>
  swaggerUi.setup(swaggerDocumentForPluralityDashboard)(req, res, next),
);
app.use('/docs-developer', swaggerUi.serve, (req: any, res: any, next: any) =>
  swaggerUi.setup(swaggerDocumentForDevDashboard)(req, res, next),
);
app.use('/docs-client', swaggerUi.serve, (req: any, res: any, next: any) =>
  swaggerUi.setup(swaggerDocumentForClient)(req, res, next),
);

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
      cert: fs.readFileSync('./local-certificates/cert.pem'),
    };
    AppDataSource.initialize()
      .then(async () => {
        await app.locals.litNodeClient.connect();
        https.createServer(options, app).listen(PORT, () => {
          console.log(`Server is running on https://app.plurality.local:${PORT}`);
        });
      })
      .catch((error) => console.log('here', error));
  }
  // Only for production
  else {
    app.set('trust proxy', 1);
    AppDataSource.initialize()
      .then(async () => {
        await app.locals.litNodeClient.connect();
        app.listen(PORT, (): void => {
          console.log(`Connected successfully on http port ${PORT}`);
        });
      })
      .catch((error) => console.log(error));
  }
} catch (error: any) {
  console.error(`Error occurred: ${error.message}`);
}
