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
import https from "https"
const fs = require('fs');



dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
// for to store coockie
app.use(cors({  
origin: 'http://172.31.37.52:3000', // Set this to match the requesting origin exactly
credentials: true, // This allows cookies and credentials to be sent with the request
methods : ['GET','POST']
}));
app.use(passport.initialize());




app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true,cookie: { secure: "auto", maxAge:1000*60*60*24} }));
app.use(passport.session());
app.use("/oauth-twitter", twitterRouter);
app.use("/permaweb", permawebRouter);
app.use("/oauth-tiktok", tiktokRouter);
app.use("/subgraph", subgraphRouter);
app.use("/stytch", stytchRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// for to store cookie to react
// app.use(function (req, res, next) {
//   res.setHeader('Cache-Control', 'no-cache');
//   res.header("Access-Control-Allow-Origin", 'http://172.31.37.52:5173'); // update to match the domain you will make the request from
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   res.header("Access-Control-Allow-Credentials", true); // allows cookie to be sent
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, HEAD, DELETE"); // you must specify the methods used with credentials. "*" will not work. 
//   next();
// });


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


try {



  // Only for development for HTTPS
if (process.env.HTTPS) {

  const options = {
    key: fs.readFileSync('./local-certificates/key.pem'),
    cert: fs.readFileSync('./local-certificates/cert.pem')
  };

  https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running on https://app.plurality.local:${PORT}`);
  });
}
else{

  app.listen(PORT, (): void => {
    console.log(`Connected successfully on port ${PORT}`);
  });
}


} catch (error: any) {
  console.error(`Error occurred: ${error.message}`);
}