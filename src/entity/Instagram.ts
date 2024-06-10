export class InstaProfile {
    id: string;
    username: string;
  
    constructor(data: any) {
      this.id = data?.id || "";
      this.username = data?.username || "";
 
    }
  }