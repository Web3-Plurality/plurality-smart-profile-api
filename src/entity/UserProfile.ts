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
        interests?: string[] = [],
        scores?: Score[] = [],
        reputation_tags?: string[] = [],
        badges?: string[] = [],
        collections?: string[] = [],
        extra?: Extra[] = [],
        linked_address?: LinkedAddress[] = []
    ) {
        this.username = username || "";
        this.avatar = avatar || "";
        this.interests = interests || [];
        this.scores = scores;
        this.reputation_tags = reputation_tags;
        this.badges = badges;
        this.collections = collections;
        this.extra = extra;
        this.linked_address = linked_address;
    }

    // You can add methods to manipulate or retrieve the data here
}
