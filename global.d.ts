declare namespace Express {
    interface Request {
      user?: { id?: string; uniqueSessionId?: string, accessToken?: string, accountId?: string, email?: string, googleJwtToken?: string }; // Replace with IToken if you have an interface
      sseID?: string;
      accessTokenID?: string;
      clientApp?: any;
    }
  }
  