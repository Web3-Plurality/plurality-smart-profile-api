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
import { stytchRouter } from './controllers/StytchController';
import { AppDataSource } from './data-source';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());
app.use(passport.initialize());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }));
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


AppDataSource.initialize()
.then(async () => {
    app.listen(PORT, (): void => {
        console.log(`Connected successfully on port ${PORT}`);
    });
}).catch((error) => console.log(error));

