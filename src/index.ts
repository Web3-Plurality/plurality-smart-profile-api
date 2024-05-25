import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from "cors";
import helmet from "helmet";
import * as dotenv from 'dotenv';
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
import { activeConnections } from './utils/global';
import { initSSE } from './middlewares/authMiddleware';


dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
// for to store coockie
app.use(cors({
  origin: ['http://app.plurality.local:3001','http://app.plurality.local:3000', 'http://localhost:3000'], // Set this to match the requesting origin exactly
  credentials: true, // This allows cookies and credentials to be sent with the request
}));
app.use(passport.initialize());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true, cookie: { secure: true, sameSite: 'none', httpOnly: true } }));
app.use(passport.session());
app.use("/oauth-twitter", twitterRouter);
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
//   console.log(req.sessionID)
//   req.session.save(() => {
//     return res.status(200).json({ "message": "register" });
//   });
// });

app.get('/register-event', async (req: Request, res: Response) => {
  const connection = activeConnections.get(req.sessionID);
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
  // Only for development for HTTPS
  if (process.env.HTTPS==="true") {

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
  else {
    AppDataSource.initialize()
    .then(async () => {
        app.listen(PORT, (): void => {
            console.log(`Connected successfully on http port ${PORT}`);
        });
    }).catch((error) => console.log(error));
  }
} catch (error: any) {
  console.error(`Error occurred: ${error.message}`);
}

