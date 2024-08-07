export class InstaProfile {
    id: string;
    username: string;
    interests: [];
  
    constructor(data: any) {
      this.id = data?.id || "";
      this.username = data?.username || "";
      this.interests = data?.interests ||  [];
    }
  }