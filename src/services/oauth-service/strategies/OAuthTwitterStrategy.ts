import OAuth2Strategy from 'passport-oauth2';
class OAuthTwitterStrategy extends OAuth2Strategy {
  constructor(options: any, verify: any) {
    super(
      {
        authorizationURL: options.authorizationURL,
        tokenURL: options.tokenURL,
        clientID: options.clientID,
        clientSecret: options.clientSecret,
        callbackURL: options.callbackURL,
        scope: options.scope,
        state: options.state,
        pkce: options.pkce,
        // if client_type is confidential then we need to encode it otherwise it gives an error "TokenError: Missing valid authorization header"
        customHeaders: Object.assign({
          Authorization: 'Basic ' + Buffer.from(`${options?.clientID}:${options?.clientSecret}`).toString('base64'),
        }),
      },
      verify,
    );
  }

  authorizationParams(options: any): any {
    return {
      ...options,
      clientType: 'confidential',
    };
  }
}

export default OAuthTwitterStrategy;
