import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { ProviderType } from '@lit-protocol/constants';
import * as dotenv from 'dotenv';
import express from 'express';
import GoogleStrategy from 'passport-google-oauth20';
import passport from 'passport';
import { Request, Response } from 'groq-sdk/_shims/auto/types';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';

dotenv.config();
export const authGoogleRouter = express.Router();

const userRepository = AppDataSource.getRepository(User);


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
    function (accessToken, refreshToken, profile, done) {
        return done("", { email: profile?._json?.email, googleAccessToken: accessToken });
    }
));


// Start the authentication flow
authGoogleRouter.get('/login', async (req: Request, res: Response, next) => {
    // Logger.info(`${FACEBOOK_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`);
    passport.authenticate('google', { scope: ['email'] })(req, res, next);
});

authGoogleRouter.get('/callback',
    passport.authenticate('google', { session: false }), async (req, res) => {
    
        console.log(req.user);
        let token = '';
        let addedUser = {};
        const uniqueSessionId = uuidv4();
        const email = req?.user?.email;
        const existingUser = await userRepository.findOne({
            where: {
                email: email,
            },
        });

        if (existingUser) {
            Logger.info(`This user already exists!`);
            token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
        } else {
            // If the user doesn't exist, insert a new row
            Logger.info(`The user with this email was not found`);
            const newUser = await userRepository.create({
                email: email,
            });
            addedUser = await userRepository.save(newUser);
            Logger.info(`new user created successfully with id ${addedUser?.id}`);
            token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: '1d' });
        }
        Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);


        // return res
        //     .status(200)
        //     .json({
        //         success: true,
        //         pluralityToken: token,
        //         googleAccessToken: req?.user?.googleAccessToken,
        //         user: existingUser?.id ? existingUser : addedUser,
        //     });

        // const nonce = ethers.hexlify(ethers.randomBytes(16));
        // console.log(nonce);
        // res.setHeader(
        //   'Content-Security-Policy',
        //   `script-src 'self' 'nonce-${nonce}';`
        // );

        // res.setHeader(
        //     'Content-Security-Policy',
        //     "script-src 'self' 'unsafe-inline';"
        //   );

        res?.redirect("http://localhost:3000/google-login?pluralityToken=" + token + "&googleAccessToken=" + req?.user?.googleAccessToken);


    });


// authGoogleRouter.get('/authenticate',async function (req, res) {

// });

