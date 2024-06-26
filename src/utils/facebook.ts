import { FacebookProfile } from '../entity/Facebook';

export function calculateReputation(data: FacebookProfile): number {
    let reputationScore: number = 0;

    // Weighted factors based on importance
    const friendsWeight: number = 0.3;
    const athletesCountWeight: number = 0.2;
    const favTeamCountWeight: number = 0.1;
    const likeCountWeight: number = 0.1;
    const musicCountWeight: number = 0.1;



    // Extract data from twitter profile
    const {
        friends_count,
        athletes_count,
        favTeam_count,
        likes_count,
        music_count,
    } = data;

    // Calculate reputation score based on weighted factors
    reputationScore += friends_count * friendsWeight;
    reputationScore += athletes_count * athletesCountWeight;
    reputationScore += favTeam_count * favTeamCountWeight;
    reputationScore += likes_count * likeCountWeight;
    reputationScore += music_count * musicCountWeight;


    // Consider verified status
    // if (verified) {
    //     reputationScore *= verifiedWeight;
    // }

    // Analyze description for keywords
    // You can customize this part based on specific criteria or keywords
    // if (description.toLowerCase().includes("expert")) {
    //     reputationScore *= 1.1;
    // }
    // if (description.toLowerCase().includes("author")) {
    //     reputationScore *= 1.2;
    // }
    // if (description.toLowerCase().includes("influencer")) {
    //     reputationScore *= 1.3;
    // }

    // Calculate reputation based on account creation date
    // if (createdAt) {       
    //     const accountAgeInYears = moment().diff(moment(createdAt), 'years');
    //     reputationScore += accountAgeInYears * createdAtWeight;
    // }

    return reputationScore;
}

