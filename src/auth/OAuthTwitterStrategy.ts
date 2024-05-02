import OAuth2Strategy  from 'passport-oauth2';
// import axios from 'axios';
class OAuthTwitterStrategy extends OAuth2Strategy {

  constructor(options : any, verify: any ) {
    super({
      authorizationURL: options.authorizationURL,
      tokenURL: options.tokenURL,
      clientID: options.clientID, // still needs this internally
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope : options.scope,
      state: options.state,
      pkce: options.pkce,
      // if client_type is confidential then we need to encode it otherwise it gives an error "TokenError: Missing valid authorization header"
      customHeaders: Object.assign({
        Authorization: 'Basic ' +
            Buffer.from(`${options?.clientID}:${options?.clientSecret}`).toString('base64'),
    })
      
    }, verify);
  }


  authorizationParams(options: any): any {
    return {
      ...options,
      clientType: 'confidential',
    }
  }


  // tokenParams(options: any) {
  //   return {
  //     ...options,
  //     // client_key: process.env.TIKTOK_CLIENT_ID,
  //     client_secret: process.env.TWITTER_CLIENT_SECRET,

  //   };
  // };



}



export default   OAuthTwitterStrategy;