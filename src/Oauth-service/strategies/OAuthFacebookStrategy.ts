import OAuth2Strategy from 'passport-oauth2';
class OAuthFacebookStrategy extends OAuth2Strategy {
  constructor(options: any, verify: any) {
    super({
      authorizationURL: options.authorizationURL,
      tokenURL: options.tokenURL,
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      scope: options.scope,
      state: options.state,
      pkce: options.pkce,
    }, verify);
  }

}

export default OAuthFacebookStrategy;