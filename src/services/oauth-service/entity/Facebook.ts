export class FacebookProfile {
  name: string;
  email: string;
  location: string;
  feed: [];
  likes: [];
  likes_count: number;
  friends_count: number;
  music_count: number;
  athletes_count: number;
  favTeam_count: number;
  reputationScore: number;
  music: [];
  favorite_athletes: [];
  favorite_teams: [];
  interests: [];

  constructor(data: any) {
    this.name = data?.name || '';
    this.email = data?.email || '';
    this.interests = data?.interests || [];
    this.location = data?.location?.name || '';
    this.feed = data?.feed?.data || [];
    this.likes = data?.likes?.data || [];
    this.music = data?.music?.data || [];
    this.favorite_athletes = data?.favorite_athletes || [];
    this.favorite_teams = data?.favorite_teams || [];
    this.likes_count = data?.likes?.data?.length || 0;
    this.music_count = data?.music?.data?.length || 0;
    this.athletes_count = data?.favorite_athletes?.length || 0;
    this.favTeam_count = data?.favorite_teams?.length || 0;
    this.friends_count = data?.friends?.summary?.total_count || 0;
    this.reputationScore = 0;
  }
}
