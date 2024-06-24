import express, { Request, Response } from "express";
import passport from "passport";
import * as dotenv from 'dotenv';
import axios from "axios";
import { isAuthenticated, isConnected } from "../middlewares/authMiddleware";
import Logger from "../lib/logger";
import { FACEBOOK_APP, FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT, FACEBOOK_FETCH_INTEREST_PROMPT, INSTA_FETCH_INTEREST_PROMPT, activeConnections } from "../utils/global";
import OAuthInstagramStrategy from "../auth/OAuthInstagramStrategy";
import { InstaProfile } from "../entity/Instagram";
import { createPrompt, extractContent } from "../utils/helper";
import { analyze } from "../utils/groq";
import { FacebookProfile } from "../entity/Facebook";

dotenv.config();

export const facebookRouter = express.Router();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
    done(null, obj);
});

passport.use(
    "facebook",
    // Strategy initialization
    new OAuthInstagramStrategy(
        {
            authorizationURL: 'https://www.facebook.com/v20.0/dialog/oauth',
            tokenURL: 'https://graph.facebook.com/v20.0/oauth/access_token',
            clientID: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            callbackURL: process.env.FACEBOOK_CALLBACK_URL,
            scope: "public_profile,email,user_likes,user_location,user_posts",
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


const getPagingData = async (nextUrl:string) => {
    let data = [];
    let url  = nextUrl;
    for (let index = 0; index < 3; index++) {
        if (url) {
            
            try {
                const moreFeed = await axios.get(
                    url,
                    {
                        headers: {

                            "Content-Type": "application/json",
                        },
                        timeout: 20000,
                    }
                );

                data = data?.concat(moreFeed.data?.data)
                url = moreFeed.data?.paging?.next || "";
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
                } else {
                    console.log(error)
                    Logger.error(`${FACEBOOK_APP}: An error occurred: ${error.message}`);
                }
                url = "";
            }

            
        }
        
    }

    return data;

}

// Start authentication flow
facebookRouter.get(
    '/',
    isConnected,
    async (req: Request, res: Response, next) => {
        Logger.info(`${FACEBOOK_APP}: Request for Oauth has been received successfully on session Id ${req.sessionID}`)
        req?.session?.redirectParams = {
            isWidget: req?.query?.isWidget,
            origin: req?.query?.origin,
            apps: req?.query?.apps,
        };
        passport.authenticate('facebook')(req, res, next);
    });

// Callback handler
facebookRouter.get('/callback', passport.authenticate('facebook', { session: false }), async (req, res) => {
    try {

        Logger.info(`${FACEBOOK_APP}: Callback has been received successfully on session Id${req.sessionID}`);
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
            Logger.info(`${FACEBOOK_APP}: Did not find the isWidget parameter in callback. Redirecting to default dashboard`);
            url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}&id_platform=twitter`
        }

        Logger.info(`${FACEBOOK_APP}: Redirecting to ${url}`);
        // it will redirect to the dashboard or widget
        res.redirect(url);
        // it will send the url to the client, and it is for testing purpose
        // res.send(url);

        // Send a message to the client that the token has been received
        if (req?.user?.accessToken && serverSentEventResponse) {
            serverSentEventResponse.write(`data: {"message":"received", "app":"${FACEBOOK_APP}"}\n\n`)
            Logger.info(`${FACEBOOK_APP}: Access token has been received successfully`);
        }
        else {
            Logger.error("An error occurred while accessing session");
            return res.status(401).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: 'Event source connection not found. Register Event' });
        }

    } catch (error: any) {
        Logger.error(`${FACEBOOK_APP}: Error during callback: ${error.message}`);
        res.status(401).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: 'Error during callback' });
    }
});

// Callback handler
facebookRouter.get('/info', isAuthenticated, async (req, res) => {
    try {
        Logger.info(`${FACEBOOK_APP}: Request for information has been received successfully on session Id ${req.sessionID}`);
        const { accessToken }: any = req?.session?.user;
        let fbUser = { data: { data: {} } }


        if (accessToken) {
            
            try {
                fbUser = await axios.get(
                    `https://graph.facebook.com/v20.0/me?fields=id,name,email,languages,location,feed{description,message},likes{about,bio,category},music{about,bio,category,name},posts{caption,description,message},favorite_athletes,favorite_teams&access_token=${accessToken}`,
                    {
                        headers: {

                            "Content-Type": "application/json",
                        },
                        timeout: 20000,
                    }
                );
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
                } else {
                    console.log(error)
                    Logger.error(`${FACEBOOK_APP}: An error occurred: ${error.message}`);
                }
            }


            const moreFeedData = await getPagingData(fbUser?.data?.feed?.paging?.next);
            const morePostsData = await getPagingData(fbUser?.data?.posts?.paging?.next);
            const moreLikesData = await getPagingData(fbUser?.data?.likes?.paging?.next);
            const moreMusicData = await getPagingData(fbUser?.data?.music?.paging?.next);

         


            
            console.log("moreFeedData>>>>",moreMusicData)
            fbUser.data.likes.data = fbUser?.data?.likes?.data?.concat(moreLikesData)
            fbUser?.data?.feed?.data =  fbUser?.data?.feed?.data?.concat(moreFeedData)
            fbUser?.data?.posts?.data = fbUser?.data?.posts?.data?.concat(morePostsData)
            fbUser?.data?.music?.data = fbUser?.data?.music?.data?.concat(moreMusicData)
            const facebookProfile = new FacebookProfile(fbUser?.data);
            const feedContent = extractContent(fbUser?.data?.feed?.data);
            const postContent = extractContent(fbUser?.data?.posts?.data);
            const favoriteAthletesContent = extractContent(fbUser?.data?.favorite_athletes);
            const favoriteTeamsContent = extractContent(fbUser?.data?.favorite_teams);
            const favoriteMusicContent = extractContent(fbUser?.data?.music?.data);

            

            const prompt1 = createPrompt(FACEBOOK_FETCH_INTEREST_PROMPT, feedContent +"\n"+ postContent);
            const prompt2 = createPrompt(FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT, favoriteAthletesContent +"\n"+ favoriteTeamsContent + "\n" + favoriteMusicContent);

            const interests1 = await analyze(prompt1);
            const interests2 = await analyze(prompt2);
            facebookProfile.interests = interests1?.Interests.concat(interests2?.Interests);

            // console.log(interests1);
            // console.log(interests2);

            
            req.session.destroy(err => {
                activeConnections.delete(req.sessionID);
                if (err) {
                    Logger.error(`${FACEBOOK_APP}: Error during session destroy: ${err.message}`);
                    return res.status(500).json({ app: FACEBOOK_APP, message: "Error during session destroy", error: err });
                }
                Logger.info(`${FACEBOOK_APP}: Session destroyed successfully`);
                Logger.info(`${FACEBOOK_APP}: User information has been delivered successfully`);
                return res.status(200).json({ app: FACEBOOK_APP, message: "success", facebookProfile: facebookProfile })
            });
        } else {
            Logger.error(`${FACEBOOK_APP}: Token has been expired.`);
            return res.status(401).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: 'Token has been expired or not found. Please log in again.' });
        }
    } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
            Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
            return res.status(408).json({ app: FACEBOOK_APP, error: 'Request Timeout', message: 'Session has expired. Please log in again.' });
        }
        else {
            Logger.error(`${FACEBOOK_APP}: Error occurred in fetching user informantion: ${error.message}`);
            return res.status(401).json({ app: FACEBOOK_APP, error: 'Unauthorized', message: 'Session has expired. Please log in again.' });
        }
    }
});