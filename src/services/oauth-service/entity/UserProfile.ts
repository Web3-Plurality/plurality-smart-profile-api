interface Score {
  score_type: string;
  score_value: number;
}

interface Extra {
  field: string;
  value: number;
}

interface LinkedAddress {
  chain_name: string;
  chain_id: number;
  address: string;
}

export class UserProfile {
  username: string;
  avatar: string;
  bio: string;
  interests: string[];
  scores: Score[];
  reputation_tags: string[];
  badges: string[];
  collections: string[];
  extra: Extra[];
  linked_address: LinkedAddress[];

  constructor(
    username?: string,
    avatar?: string,
    bio?: string,
    interests: string[] = [],
    scores: Score[] = [],
    reputation_tags: string[] = [],
    badges: string[] = [],
    collections: string[] = [],
    extra: Extra[] = [],
    linked_address: LinkedAddress[] = [],
  ) {
    this.username = username || '';
    this.avatar = avatar || '';
    this.bio = bio || '';
    this.interests = interests || [];
    this.scores = scores;
    this.reputation_tags = reputation_tags;
    this.badges = badges;
    this.collections = collections;
    this.extra = extra;
    this.linked_address = linked_address;
  }

  // // You can add methods to manipulate or retrieve the data here
  // aggregateProfile(user: UserProfile){
  //     this.collections = this.collections.concat(user.collections);
  //     this.interests = this.interests.concat(user.interests);
  //     this.reputation_tags = this.reputation_tags.concat(user.reputation_tags);
  //     this.badges = this.badges.concat(user.badges);
  //     this.extra = this.extra.concat(user.extra);
  //     this.linked_address = this.linked_address.concat(user.linked_address);
  //     // if score value is match then add the value
  //     const updatedScores = this.scores.map(score => {
  //         const userScore = user.scores.find(us => us.score_type === score.score_type);
  //         if (userScore) {
  //             return {
  //                 ...score,
  //                 score_value: score.score_value + userScore.score_value
  //             };
  //         }
  //         return score;
  //     });
  //     // update the score
  //     this.scores = updatedScores

  // }
}
