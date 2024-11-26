export class RobloxProfile {
  createdAt: number;
  joinDate: string;
  placesVisit: number;
  friends: number;
  followers: number;
  following: number;
  avatar: string;
  name: string;
  nickname: string;
  picture: string;
  profile: string;
  sub: string;
  premium: boolean;
  idVerified: boolean;
  interests: string[];
  introTags: string[];
  assests: any[];
  about: string;
  preferredUsername: string;
  reputationScore: number;

  constructor(data: any = {}) {
    this.createdAt = data?.created_at || 0;
    this.joinDate = '';
    this.placesVisit = 0;
    this.friends = 0;
    this.followers = 0;
    this.following = 0;
    this.avatar = '';
    this.name = data?.name || '';
    this.nickname = data?.nickname || '';
    this.picture = data?.picture || '';
    this.preferredUsername = data?.preferred_username || '';
    this.profile = data?.profile || '';
    this.sub = data?.sub || '';
    this.premium = data?.premium || false;
    this.idVerified = data?.idVerified || false;
    this.interests = [];
    this.introTags = [];
    this.assests = [];
    this.reputationScore = 0;
    this.about = data?.about || '';
  }
}
