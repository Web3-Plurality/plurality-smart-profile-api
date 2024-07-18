import OAuth2Strategy from 'passport-oauth2';
class OAuthFortniteStrategy extends OAuth2Strategy {
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
      customHeaders: Object.assign({
        Authorization: 'Basic ' +
          Buffer.from(`${options?.clientID}:${options?.clientSecret}`).toString('base64'),
      })
    }, verify);
  }
  // authorizationParams(options: any): any {
  //   return {
  //     ...options,
  //     clientType: 'confidential',
  //   }
  // }


  // tokenParams(options: any) {
  //   return {
  //     ...options,
  //     grant_type: "authorization_code",
  //     deployment_id: "61c0c08cc11e4db78aeec719e0a28e21",
  //     scope: "basic_profile",
  //   };
  // };

}




export default OAuthFortniteStrategy;