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



}



export default   TikTokOAuth2Strategy;