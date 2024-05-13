// Define TypeScript classes
export class Insights {
    Interests: string[];
    Hashtags: string[];
    ExtraTags: string[];
  
    constructor(interests: string[] = [], hashtags: string[] = [], extraTags: string[] = []) {
      this.Interests = interests;
      this.Hashtags = hashtags;
      this.ExtraTags = extraTags;
    }
  }
  
  
  export class PinnedTweet {
    username: string;
    Views: string;
    date: string;
    Reposts: string;
    Quotes: string;
    Likes: string;
    Bookmarks: string;
    tweetText: string;
    insights: Insights;
  
    constructor(
      username: string = "@defaultUser",
      Views: string = "0",
      date: string = "Not specified",
      Reposts: string = "0",
      Quotes: string = "0",
      Likes: string = "0",
      Bookmarks: string = "0",
      tweetText: string = "No text",
      insights: Insights = new Insights()
    ) {
      this.username = username;
      this.Views = Views;
      this.date = date;
      this.Reposts = Reposts;
      this.Quotes = Quotes;
      this.Likes = Likes;
      this.Bookmarks = Bookmarks;
      this.tweetText = tweetText;
      this.insights = insights;
    }
  }
    
  export class TwitterProfile {
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
    id: string;
  
    constructor(
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
      id: string = ""
    ) {
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
      this.id = id;
    }
  }
  