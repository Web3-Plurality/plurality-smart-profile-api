export class FacebookProfile {
    id: string;
    name: string;
    email: string;
    location: string;
    feed: [];
    likes: [];
    music: [];
    posts: [];
    favorite_athletes: [];
    favorite_teams: [];
    interests: [];
  
    constructor(data: any) {
      this.id = data?.id || "";
      this.name = data?.name || "";
      this.email = data?.email || "";
      this.interests = data?.interests ||  [];
      this.location = data?.location?.name || "";
      this.feed = data?.feed?.data || [];
      this.likes = data?.likes?.data || [];
      this.music = data?.music?.data || [];
      this.posts = data?.posts?.data || [];
      this.favorite_athletes = data?.favorite_athletes || [];
      this.favorite_teams = data?.favorite_teams || [];
        

    }
  }