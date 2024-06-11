import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { INSTAGRAM_APP, INSTA_FETCH_INTEREST_PROMPT, activeConnections } from "../utils/global";
import OAuthInstagramStrategy from "../auth/OAuthInstagramStrategy";
import { InstaProfile } from "../entity/Instagram";
import { createPrompt } from "../utils/helper";
import { analyze } from "../utils/groq";

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
            console.log("Verify")
            return done(null, { accessToken, refreshToken, profile });
        }
    )
);

// Start authentication flow
instagramRouter.get(
    '/',
    isConnected,
    async (req: Request, res: Response, next) => {
        Logger.info(`${INSTAGRAM_APP}: Request for Oauth has been received successfully on session Id ${req.sessionID}`)
        req?.session?.redirectParams = {
            isWidget: req?.query?.isWidget,
            origin: req?.query?.origin,
            apps: req?.query?.apps,
        };
        passport.authenticate('instagram')(req, res, next);
    });

// Callback handler
instagramRouter.get('/callback', passport.authenticate('instagram', { session: false }), async (req, res) => {
    try {

        Logger.info(`${INSTAGRAM_APP}: Callback has been received successfully on session Id${req.sessionID}`);
        let url: any;
        const { isWidget, origin, apps } = req.session.redirectParams;
        const serverSentEventResponse = activeConnections.get(req.sessionID);
        req.session.user = {
            accessToken: req.user.accessToken,
            refreshToken: req.user.refreshToken
        }

        if (isWidget == 'true')
            url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
        else if (isWidget == 'false')
            url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
        else {
            Logger.info(`${INSTAGRAM_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
            url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
        }

        Logger.info(`${INSTAGRAM_APP}: Redirecting to ${url}`);
        // it will redirect to the dashboard or widget
        res.redirect(url);
        // it will send the url to the client, and it is for testing purpose
        // res.send(url);

        // Send a message to the client that the token has been received
        if (req?.user?.accessToken && serverSentEventResponse) {
            serverSentEventResponse.write(`data: {"message":"received", "app":"${INSTAGRAM_APP}"}\n\n`)
            Logger.info(`${INSTAGRAM_APP}: Access token of Twitter received successfully`);
        }
        else {
            Logger.error("An error occurred while accessing session");
            return res.status(401).json({ app: INSTAGRAM_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
        }

    } catch (error: any) {
        Logger.error(`${INSTAGRAM_APP}: Error during callback: ${error.message}`);
        res.status(401).json({ app: INSTAGRAM_APP, error: 'Unauthorized', message: 'Error during callback' });
    }
});

// Callback handler
instagramRouter.get('/info', isAuthenticated, async (req, res) => {
    try {
        Logger.info(`${INSTAGRAM_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
        const { accessToken }: any = req?.session?.user;
        let instaUser = { data: { data: {} } }
        let instaMedia = { data: { data: [] } }

        if (accessToken) {
            //   const tweetFields = [
            //     'attachments', 'author_id', 'context_annotations', 'conversation_id', 'created_at', 'edit_controls', 'entities', 'geo', 'id', 'in_reply_to_user_id', 'lang', 'non_public_metrics', 'public_metrics', 'organic_metrics', 'promoted_metrics', 'possibly_sensitive', 'referenced_tweets', 'reply_settings', 'source', 'text', 'withheld'
            //   ];
            //   const userFields = [
            //     'created_at', 'description', 'entities', 'id', 'location', 'most_recent_tweet_id', 'name', 'pinned_tweet_id', 'profile_image_url', 'protected', 'public_metrics', 'url', 'username', 'verified', 'verified_type', 'withheld'
            //   ]

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
                    console.log(error)
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
                    console.log(error)
                    Logger.error(`${INSTAGRAM_APP}: An error occurred: ${error.message}`);
                }
            }

            const prompt = createPrompt(INSTA_FETCH_INTEREST_PROMPT, instaMedia?.data?.data )
            const interests = await analyze(prompt)
            const instaProfile = new InstaProfile(instaUser?.data);
            instaProfile.interests = interests.Interests;
            
            req.session.destroy(err => {
                activeConnections.delete(req.sessionID);
                if (err) {
                    Logger.error(`${INSTAGRAM_APP}: Error during session destroy: ${err.message}`);
                    return res.status(500).json({ app: INSTAGRAM_APP, message: "Error during session destroy", error: err });
                }
                Logger.info(`${INSTAGRAM_APP}: Session destroyed successfully`);
                Logger.info(`${INSTAGRAM_APP}: User information has been delivered successfully`);
                return res.status(200).json({ app: INSTAGRAM_APP, message: "success", instaProfile: instaProfile })
            });
        } else {
            Logger.error(`${INSTAGRAM_APP}: Token has been expired.`);
            return res.status(401).json({ app: INSTAGRAM_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
        }
    } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
            Logger.error(`${INSTAGRAM_APP}: Request timeout error in fetching userinfo: ${error.message}`);
            return res.status(408).json({ app: INSTAGRAM_APP, error: 'Request Timeout', message: 'Session has expired. Please log in again.' });
        }
        else {
            Logger.error(`${INSTAGRAM_APP}: Error occurred in fetching user informantion: ${error.message}`);
            return res.status(401).json({ app: INSTAGRAM_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
        }
    }
});