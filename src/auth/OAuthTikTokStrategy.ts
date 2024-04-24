import OAuth2Strategy  from 'passport-oauth2';
// import axios from 'axios';
class TikTokOAuth2Strategy extends OAuth2Strategy {

  constructor(options : any, verify: any ) {
    super({
      authorizationURL: options.authorizationURL,
      tokenURL: options.tokenURL,
      clientID: options.clientKey, // still needs this internally
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope : options.scope,
      state: options.state,
      
    }, verify);
  }


  authorizationParams(options: any): any {
    return {
      ...options,
      client_key: process.env.TIKTOK_CLIENT_ID,
    }
  }


  tokenParams(options: any) {
    return {
      ...options,
      client_key: process.env.TIKTOK_CLIENT_ID,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,

    };
  };


  // userProfile = asyncfunction(accessToken : string , done : any) {
  //   if (accessToken) {

  //     const userObjField = [
  //       "open_id",
  //       "union_id",
  //       "avatar_url",
  //       "display_name",
  //       "bio_description",
  //       "profile_deep_link",
  //       "is_verified",
  //       "username",
  //       "follower_count",
  //       "following_count",
  //       "likes_count",
  //       "video_count"
  //     ];

  //     const videoObjFields = [
  //       "id",
  //       "create_time",
  //       "cover_image_url",
  //       "share_url",
  //       "video_description",
  //       "duration",
  //       "height",
  //       "width",
  //       "title",
  //       // "embed_html", //not seems to be useful
  //       "embed_link",
  //       "like_count",
  //       "comment_count",
  //       "share_count",
  //       "view_count"
  //     ]



  //     // request for user info
  //     const userData = await axios.get(
  //       `https://open.tiktokapis.com/v2/user/info/?fields=${userObjField.join(",")}`,

  //       {
  //         headers: {
  //           Authorization: `Bearer ${accessToken}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );



  //     //request for videoObj list of user
  //     const videoList = await axios.post(
  //       `https://open.tiktokapis.com/v2/video/list/?fields=${videoObjFields.join(",")}`,

  //       {
  //         max_count: 20
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${accessToken}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

   

  //   return done(null, {user:userData, video: videoList, userObjField:userObjField, videoObjFields:videoObjFields});
  // };

  // // Override the method to change the authorization URL
  // authorizationParams(options :any) {
  //   const params = super.authorizationParams(options);
  //   console.log(params)
  //   params.client_key = params.client_id;
  //   delete params.client_id;
  //   return params;
  // }

}

// Use this custom strategy in passport
// passport.use(new CustomOAuth2Strategy({
//   authorizationURL: 'https://provider.com/oauth2/authorize',
//   tokenURL: 'https://provider.com/oauth2/token',
//   clientKey: 'YOUR_CLIENT_KEY',
//   clientSecret: 'YOUR_CLIENT_SECRET',
//   callbackURL: 'http://localhost:3000/auth/provider/callback'
// }, function(accessToken, refreshToken, profile, cb) {
//   return cb(null, profile);
// }));


module.exports =  TikTokOAuth2Strategy;