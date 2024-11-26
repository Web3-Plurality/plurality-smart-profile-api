export class FacebookProfile {
  name: string;
  email: string;
  location: string;
  feed: [];
  likes: [];
  likesCount: number;
  friendsCount: number;
  musicCount: number;
  athletesCount: number;
  favTeamCount: number;
  reputationScore: number;
  music: [];
  favoriteAthletes: [];
  favoriteTeams: [];
  interests: [];

  constructor(data: any) {
    this.name = data?.name || '';
    this.email = data?.email || '';
    this.interests = data?.interests || [];
    this.location = data?.location?.name || '';
    this.feed = data?.feed?.data || [];
    this.likes = data?.likes?.data || [];
    this.music = data?.music?.data || [];
    this.favoriteAthletes = data?.favorite_athletes || [];
    this.favoriteTeams = data?.favorite_teams || [];
    this.likesCount = data?.likes?.data?.length || 0;
    this.musicCount = data?.music?.data?.length || 0;
    this.athletesCount = data?.favorite_athletes?.length || 0;
    this.favTeamCount = data?.favorite_teams?.length || 0;
    this.friendsCount = data?.friends?.summary?.total_count || 0;
    this.reputationScore = 0;
  }
}
