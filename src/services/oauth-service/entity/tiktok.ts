class User {
  videoCount: number; //repu
  bioDescription: string; //repu
  displayName: string;
  followerCount: number; //repu
  isVerified: boolean; // repu
  username: string;
  avatarUrl: string;
  followingCount: number; //repu
  likesCount: number; //repu
  profileDeepLink: string;

  constructor(data: any = {}) {
    this.videoCount = data.video_count || 0;
    this.bioDescription = data.bio_description || '';
    this.displayName = data.display_name || '';
    this.followerCount = data.follower_count || 0;
    this.isVerified = data.is_verified || false;
    this.username = data.username || '';
    this.avatarUrl = data.avatar_url || '';
    this.followingCount = data.following_count || 0;
    this.likesCount = data.likes_count || 0;
    this.profileDeepLink = data.profile_deep_link || '';
  }
}

class Video {
  title: string;
  viewCount: number;
  // width: number;
  shareCount: number;
  embedLink: string;
  likeCount: number;
  videoDescription: string;
  commentCount: number;
  duration: number;
  coverImageUrl: string;
  // height: number;
  id: string;
  shareUrl: string;
  createTime: number;

  constructor(data: any = {}) {
    this.title = data.title || '';
    this.viewCount = data.view_count || 0; //repu
    // this.width = data.width || 0;
    this.shareCount = data.share_count || 0; //repu
    this.embedLink = data.embed_link || '';
    this.likeCount = data.like_count || 0; //repu
    this.videoDescription = data.video_description || '';
    this.commentCount = data.comment_count || 0; //repu
    this.duration = data.duration || 0;
    this.coverImageUrl = data.cover_image_url || '';
    // this.height = data.height || 0;
    this.id = data.id || '';
    this.shareUrl = data.share_url || '';
    this.createTime = data.create_time || 0;
  }
}

export class TikTokProfile {
  user: User;
  video: Video[];
  interests: string[];
  reputationScore: number;
  introTags: string[];

  constructor(data: any = {}) {
    this.user = new User(data.user);
    this.video = (data.video || []).map((v: any) => new Video(v));
    this.interests = [];
    this.reputationScore = 0;
    this.introTags = [];
  }
}
