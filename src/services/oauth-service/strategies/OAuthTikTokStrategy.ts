import OAuth2Strategy from 'passport-oauth2';
class TikTokOAuth2Strategy extends OAuth2Strategy {
  constructor(options: any, verify: any) {
    super(
      {
        authorizationURL: options.authorizationURL,
        tokenURL: options.tokenURL,
        clientID: options.clientKey,
        clientSecret: options.clientSecret,
        callbackURL: options.callbackURL,
        scope: options.scope,
        state: options.state,
      },
      verify,
    );
  }
  /* eslint-disable */
  authorizationParams(options: any): any {
    return {
      ...options,
      client_key: process.env.TIKTOK_CLIENT_ID,
    };
  }

  tokenParams(options: any) {
    return {
      ...options,
      client_key: process.env.TIKTOK_CLIENT_ID,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
    };
  }
}
/* eslint-enable */
export default TikTokOAuth2Strategy;
