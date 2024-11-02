export class TwitterProfile {
  id: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  likeCount: number;
  pinnedTweetId: string;
  verifiedType: string;
  protected: boolean;
  username: string;
  mostRecentTweetId: string;
  verified: boolean;
  description: string;
  createdAt: string;
  name: string;
  profileImageUrl: string;
  interests: string[];
  reputationScore: number;
  introTags: string[];

  constructor(
    id = '',
    followersCount = 0,
    followingCount = 0,
    tweetCount = 0,
    listedCount = 0,
    likeCount = 0,
    pinnedTweetId = '',
    verifiedType = '',
    protectedStatus = false,
    username = '',
    mostRecentTweetId = '',
    verified = false,
    description = '',
    createdAt = '',
    name = '',
    profileImageUrl = '',
    interests: string[] = [],
    reputationScore = 0,
    introTags: string[] = [],
  ) {
    this.id = id;
    this.followersCount = followersCount;
    this.followingCount = followingCount;
    this.tweetCount = tweetCount;
    this.listedCount = listedCount;
    this.likeCount = likeCount;
    this.pinnedTweetId = pinnedTweetId;
    this.verifiedType = verifiedType;
    this.protected = protectedStatus;
    this.username = username;
    this.mostRecentTweetId = mostRecentTweetId;
    this.verified = verified;
    this.description = description;
    this.createdAt = createdAt;
    this.name = name;
    this.profileImageUrl = profileImageUrl;
    this.interests = interests;
    this.reputationScore = reputationScore;
    this.introTags = introTags;
  }
}
