import moment from 'moment';
import { TwitterProfile } from '../entity/Twitter';

export function calculateReputation(data: TwitterProfile): number {
    let reputationScore: number = 0;

    // Weighted factors based on importance
    const followersWeight: number = 0.3;
    const tweetCountWeight: number = 0.2;
    const listedCountWeight: number = 0.1;
    const likeCountWeight: number = 0.1;
    const verifiedWeight: number = 0.2;
    const descriptionWeight: number = 0.1;
    const createdAtWeight: number = 0.1; // Weight for account creation date

    // Extract data from instagram profile
    const {
        followersCount,
        tweetCount,
        listedCount,
        likeCount,
        verified,
        description,
        createdAt
    } = data;

    // Calculate reputation score based on weighted factors
    reputationScore += followersCount * followersWeight;
    reputationScore += tweetCount * tweetCountWeight;
    reputationScore += listedCount * listedCountWeight;
    reputationScore += likeCount * likeCountWeight;

    // Consider verified status
    if (verified) {
        reputationScore *= verifiedWeight;
    }

    // Analyze description for keywords
    // You can customize this part based on specific criteria or keywords
    if (description.toLowerCase().includes("expert")) {
        reputationScore *= 1.1;
    }
    if (description.toLowerCase().includes("author")) {
        reputationScore *= 1.2;
    }
    if (description.toLowerCase().includes("influencer")) {
        reputationScore *= 1.3;
    }

    // Calculate reputation based on account creation date
    if (createdAt) {       
        const accountAgeInYears = moment().diff(moment(createdAt), 'years');
        reputationScore += accountAgeInYears * createdAtWeight;
    }

    return reputationScore;
}

