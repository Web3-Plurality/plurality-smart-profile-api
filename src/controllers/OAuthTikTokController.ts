import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import TikTokOAuth2Strategy from "../auth/OAuthTikTokStrategy"
export const tiktokRouter = express.Router();
import passport from "passport";
import axios from "axios";
import { parseQueryString } from "../utils";



dotenv.config();

// Serialization and deserialization
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj: any, done) {
  done(null, obj);
});


// const btoa = (str:string) => Buffer.from(str, 'binary').toString('base64');

passport.use("tiktok", new TikTokOAuth2Strategy(
  // Strategy initialization
     {
       authorizationURL: 'https://www.tiktok.com/v2/auth/authorize/',
       tokenURL: 'https://open.tiktokapis.com/v2/oauth/token/',
       clientKey: process.env.TIKTOK_CLIENT_ID,
       clientSecret: process.env.TIKTOK_CLIENT_SECRET,
       callbackURL: `https://app.plurality.local:5000/oauth-tiktok/callback`,
       scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
       state: false
     },
     // Verify callback
     (accessToken: any, refreshToken: any, profile: any, done: any) => {
       return done(null, { accessToken: accessToken, refreshToken: refreshToken });
     }
 
   ));


tiktokRouter.get('/',

async (req: Request, res: Response, next) => {
  
  const isWidget = req.query.isWidget;
  const origin = req.query.origin;
  const apps = req.query.apps;

  const state = encodeURIComponent(`?isWidget=${isWidget}&origin=${origin}&apps=${apps}`)
  
  passport.authenticate('tiktok', { state })(req, res, next);
})



tiktokRouter.get('/callback', passport.authenticate("tiktok"), async (req, res) => {
  try {


    console.log(parseQueryString(decodeURIComponent(req.query.state)) )
    const { isWidget, origin, apps} = parseQueryString(decodeURIComponent(req.query.state))


    const { accessToken, refreshToken } = req.user;



    if (accessToken) {

      const userObjField = [
        "open_id",
        "union_id",
        "avatar_url",
        "display_name",
        "bio_description",
        "profile_deep_link",
        "is_verified",
        "username",
        "follower_count",
        "following_count",
        "likes_count",
        "video_count"
      ];

      const videoObjFields = [
        "id",
        "create_time",
        "cover_image_url",
        "share_url",
        "video_description",
        "duration",
        "height",
        "width",
        "title",
        // "embed_html", //not seems to be useful
        "embed_link",
        "like_count",
        "comment_count",
        "share_count",
        "view_count"
      ]



      // request for user info
      const userData = await axios.get(
        `https://open.tiktokapis.com/v2/user/info/?fields=${userObjField.join(",")}`,

        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );



      //request for videoObj list of user
      const videoList = await axios.post(
        `https://open.tiktokapis.com/v2/video/list/?fields=${videoObjFields.join(",")}`,

        {
          max_count: 20
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );




      console.log("##########UserInfo#####\n\n")
      console.log(userData.data);//Lists all videos of user along with other details
      console.log("##########VideoInfo#####\n\n")
      console.log(videoList?.data?.data?.videos);//Lists all videos of user along with other details




      let url: any;

      if (isWidget == 'true')
        url = `${process.env.WIDGET_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
      else if (isWidget == 'false')
        url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
      else {
        console.log('Did not find the isWidget parameter in callback. Redirecting to default dashboard');
        url = `${process.env.DASHBOARD_UI_URL}?isWidget=${isWidget}&origin=${origin}&apps=${apps}`
      }


      // user info 
      userObjField.forEach(field => {
        url += `&${field}=${userData?.data?.data?.user[field]}`;
      });


      //video info
      for (let index = 0; index < videoList?.data?.data?.videos?.length; index++) {
        videoObjFields.forEach(field => {
          //v${index} this will help to to identify same variable of separate video
          url += `&v${index}${field}=${videoList?.data?.data?.videos[index]?.[field]}`;
        });

      }



      // res.redirect(url);
      res.send(url);


    }


  } catch (error: any) {
    console.error("Error during callback:", error.message);
    res.status(500).send("An error occurred during the login process.");
  }


}

);