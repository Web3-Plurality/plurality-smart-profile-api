// Define TypeScript classes
// export class Insights {
//     Interests: string[];
//     Hashtags: string[];
//     ExtraTags: string[];
  
//     constructor(interests: string[] = [], hashtags: string[] = [], extraTags: string[] = []) {
//       this.Interests = interests;
//       this.Hashtags = hashtags;
//       this.ExtraTags = extraTags;
//     }
//   }
  
  
  export class PinnedTweet {
    url: string;
    username: string;
    views: string;
    date: string;
    reposts: string;
    quotes: string;
    likes: string;
    bookmarks: string;
    tweetText: string;
    interests: string[];
  
    constructor(
      url: string = "",
      username: string = "@defaultUser",
      views: string = "0",
      date: string = "Not specified",
      reposts: string = "0",
      quotes: string = "0",
      likes: string = "0",
      bookmarks: string = "0",
      tweetText: string = "",
      interests: string[] = []
    ) {
      this.url = url,
      this.username = username;
      this.views = views;
      this.date = date;
      this.reposts = reposts;
      this.quotes = quotes;
      this.likes = likes;
      this.bookmarks = bookmarks;
      this.tweetText = tweetText;
      this.interests = interests;
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
  