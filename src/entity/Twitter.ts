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
  
    constructor(
    id: string = "",
      followersCount: number = 0,
      followingCount: number = 0,
      tweetCount: number = 0,
      listedCount: number = 0,
      likeCount: number = 0,
      pinnedTweetId: string = "",
      verifiedType: string = "",
      protectedStatus: boolean = false,
      username: string = "",
      mostRecentTweetId: string = "",
      verified: boolean = false,
      description: string = "",
      createdAt: string = "",
      name: string = "",
      profileImageUrl: string = "",
      interests: string[] = []
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
    }
  }
  