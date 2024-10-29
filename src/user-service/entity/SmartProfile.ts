import { SCORE_TYPES } from "../../utils/global";
import { UserProfile } from "../../Oauth-service/entity/UserProfile";

interface Score {
    score_type: string;
    score_value: number;
}

interface ConnectedProfiles {
    platform_name: string;
    user_platform_id: string | null;
    username?: string | null;
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

export class SmartProfile {
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
    connected_profiles: ConnectedProfiles[];
    connected_platforms: string[];

    constructor(
        data: any,
    ) {
        this.username = data?.username || "";
        this.avatar = data?.avatar || "";
        this.bio = data?.bio || "";
        this.interests = data?.interests || [];
        this.reputation_tags = data?.reputation_tags || [];
        this.badges = data?.badges || [];
        this.collections = data?.collections || [];
        this.extra = data?.extra || [];
        this.linked_address = data?.linked_address || [];
        this.connected_profiles = data?.connected_profiles || [];
        this.connected_platforms = data?.connected_platforms || [];
        this.scores = Object.values(SCORE_TYPES).map(scoreType => ({
            score_type: scoreType,
            score_value: 0
        }));
    }

    // You can add methods to manipulate or retrieve the data here
    aggregateProfile(user: SmartProfile) {
        this.collections = this.collections.concat(user.collections);
        this.interests = this.interests.concat(user.interests);
        this.reputation_tags = this.reputation_tags.concat(user.reputation_tags);
        this.badges = this.badges.concat(user.badges);
        this.extra = this.extra.concat(user.extra);
        this.linked_address = this.linked_address.concat(user.linked_address);
        if (user instanceof SmartProfile) {
            const newProfile = user.connected_profiles.filter(profile => !this.connected_profiles.includes(profile));
            this.connected_profiles = this.connected_profiles.concat(newProfile);
        }
        const updatedScores = this.scores.map(score => {
            const userScore = user.scores.find(us => us.score_type === score.score_type);
            if (userScore) {
                return {
                    ...score,
                    score_value: score.score_value + userScore.score_value
                };
            }
            return score;
        });
        // update the score
        this.scores = updatedScores
    }

    updateScoreValue(scoreType: string, newValue: number) {
        this.scores = this.scores.map(score => {
            if (score.score_type === scoreType) {
                return {
                    ...score,
                    score_value: newValue
                };
            }
            return score;
        });
    }
}
