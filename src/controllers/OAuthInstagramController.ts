import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { hasValidAccessTokenHeader, hasValidEventHeader, hasValidEventParam, isAuthenticated } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INSTAGRAM_APP, INTERNAL_SERVER_ERROR, TIMEOUT_ERROR, createPrompt, memoryStoreToken, memoryStoreSSE, memoryStoreProfile } from "../utils/global";
import OAuthInstagramStrategy from "../auth/OAuthInstagramStrategy";
import { InstaProfile } from "../entity/Instagram";
import { analyze } from "../utils/groq";
import { INSTA_FETCH_INTEREST_PROMPT } from "../utils/aiPrompts";
import { v4 as uuidv4 } from 'uuid';
import { UserProfile } from "../entity/UserProfile";
dotenv.config();

export const instagramRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
    done(null, obj);
});

passport.use(
    "instagram",
    // Strategy initialization
    new OAuthInstagramStrategy(
        {
            authorizationURL: 'https://api.instagram.com/oauth/authorize',
            tokenURL: 'https://api.instagram.com/oauth/access_token',
            clientID: process.env.INSTAGRAM_CLIENT_ID,
            clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
            callbackURL: process.env.INSTAGRAM_CALLBACK_URL,
            scope: "user_profile,user_media",
            state: true,
            pkce: true,
        },
        // Verify callback
        (accessToken: any, refreshToken: any, profile: any, done: any) => {
            return done(null, { accessToken, refreshToken, profile });
        }
    )
);

// Start authentication flow
instagramRouter.get(
    '/',
    hasValidEventParam,
    isAuthenticated,
    async (req: Request, res: Response, next) => {
        Logger.info(`${INSTAGRAM_APP}: Request for Oauth has been received successfully on sse Id ${req.sseID}`)
        passport.authenticate('instagram')(req, res, next);
    });


// Callback handler
instagramRouter.get('/callback', passport.authenticate('instagram', { session: false }), async (req, res) => {
    try {
        const accessTokenId = uuidv4();
        memoryStoreToken.set(accessTokenId, req.user.accessToken);
        const url = `${process.env.WIDGET_UI_URL}?token_id=${accessTokenId}&app=${INSTAGRAM_APP}`;
        Logger.info(`${INSTAGRAM_APP}: Redirecting to ${url}`);
        res.redirect(url);
    } catch (error: any) {
        Logger.error(`${INSTAGRAM_APP}: Error during callback: ${error.message}`);
        res.status(500).json({ app: INSTAGRAM_APP, message: 'Error during callback' });
    }
});

// Send Event to Iframe
instagramRouter.post(
    '/event',
    hasValidEventHeader,
    hasValidAccessTokenHeader,
    isAuthenticated,
    async (req: Request, res: Response) => {
        try {
            Logger.info(`${INSTAGRAM_APP}: Request body tokenUUID ${req?.accessTokenID}`);
            Logger.info(`${INSTAGRAM_APP}: Request body sseUUID ${req?.sseID}`);
            const serverSentEventResponse = memoryStoreSSE.get(req?.sseID);
            serverSentEventResponse.write(`data: {"message":"received", "app":"${INSTAGRAM_APP}", "auth":"${req?.accessTokenID}"}\n\n`)
            Logger.info(`${INSTAGRAM_APP}: Server Side Event has been sent successfully`);
            memoryStoreSSE.delete(req?.sseID);
            return res.status(200).json({ app: INSTAGRAM_APP, message: "success" });
        } catch (error) {
            Logger.info(`${INSTAGRAM_APP}:  Error in sending SSE ${error.message}`);
            return res.status(500).json({ app: INSTAGRAM_APP, message: "Internal Server error" });
        }

    });

// Return User Object
instagramRouter.get('/info', hasValidAccessTokenHeader, isAuthenticated, async (req, res) => {
    try {
        Logger.info(`${INSTAGRAM_APP}: Request for information has been received successfully with id ${req.accessTokenID}`);
        const accessToken = memoryStoreToken.get(req.accessTokenID)
        let instaUser = { data: { data: {} } }
        let instaMedia = { data: { data: [] } }

        if (accessToken) {
            try {
                instaUser = await axios.get(
                    `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        timeout: 20000,
                    }
                );
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
                } else {
                    Logger.error(`${INSTAGRAM_APP}: An error occurred: ${error.message}`);
                }
            }

            try {
                instaMedia = await axios.get(
                    `https://graph.instagram.com/me/media?fields=id,caption&access_token=${accessToken}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        timeout: 20000,
                    }
                );
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
                } else {
                    Logger.error(`${INSTAGRAM_APP}: An error occurred: ${error.message}`);
                }
            }

            const prompt = createPrompt(INSTA_FETCH_INTEREST_PROMPT, instaMedia?.data?.data)
            const interests = await analyze(prompt)
            const instaProfile = new InstaProfile(instaUser?.data);
            instaProfile.interests = interests?.Interests || [];

            // Create user profile object
            const userProfile = new UserProfile();
            userProfile.username = instaProfile?.username;
            userProfile.interests = instaProfile?.interests;

            if (memoryStoreProfile.get(req?.user?.uniqueSessionId)) {
                memoryStoreProfile.get(req?.user?.uniqueSessionId).aggregateProfile(userProfile);
            } else {
                memoryStoreProfile.set(req?.user?.uniqueSessionId, userProfile)
            }

            memoryStoreToken.delete(req?.accessTokenID);
            Logger.info(`${INSTAGRAM_APP}: Session destroyed successfully`);
            Logger.info(`${INSTAGRAM_APP}: User information has been delivered successfully`);
            return res.status(200).json({ app: INSTAGRAM_APP, message: "success", instaProfile: userProfile })

        } else {
            Logger.error(`${INSTAGRAM_APP}: Token has been expired.`);
            return res.status(500).json({ app: INSTAGRAM_APP, message: INTERNAL_SERVER_ERROR });
        }
    } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
            Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
            return res.status(408).json({ app: INSTAGRAM_APP, message: TIMEOUT_ERROR });
        }
        else {
            Logger.error(`${INSTAGRAM_APP}: Error occurred in fetching user informantion: ${error.message}`);
            return res.status(500).json({ app: INSTAGRAM_APP, message: INTERNAL_SERVER_ERROR });
        }
    }
});