import { TikTokProfile } from '../entity/Tiktok';

export function calculateReputation(data: TikTokProfile): number {
  let reputationScore = 0;

  // Weighted factors based on importance
  const videoCountWeight = 0.3;
  const followingCountWeight = 0.2;
  const followerCountWeight = 0.1;
  const likesCountWeight = 0.1;
  const verifiedWeight = 0.2;
  // const bioDescriptionWeight: number = 0.1;
  // const createdAtWeight: number = 0.1; // Weight for account creation date

  // Extract data from tiktok profile
  const { videoCount, bioDescription, followerCount, isVerified, followingCount, likesCount } = data?.user;

  // Calculate reputation score based on weighted factors
  reputationScore += followerCount * followerCountWeight;
  reputationScore += followingCount * followingCountWeight;
  reputationScore += videoCount * videoCountWeight;
  reputationScore += likesCount * likesCountWeight;

  // Consider verified status
  if (isVerified) {
    reputationScore *= verifiedWeight;
  }

  // Analyze description for keywords
  // You can customize this part based on specific criteria or keywords
  // if (bioDescription.toLowerCase().includes("expert")) {
  //     reputationScore *= 1.1;
  // }
  // if (bioDescription.toLowerCase().includes("author")) {
  //     reputationScore *= 1.2;
  // }
  // if (bioDescription.toLowerCase().includes("influencer")) {
  //     reputationScore *= 1.3;
  // }

  // Calculate reputation based on account creation date
  // if (createdAt) {
  //     const accountAgeInYears = moment().diff(moment(createdAt), 'years');
  //     reputationScore += accountAgeInYears * createdAtWeight;
  // }

  return reputationScore;
}
