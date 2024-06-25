export class RobloxProfile {
    created_at: number;
    name: string;
    nickname: string;
    picture: string;
    preferred_username: string;
    profile: string;
    sub: string;
    premium: boolean;
    idVerified: boolean;
    interests: string[];
    constructor(data: any = {}) {
        this.created_at = data.created_at || 0;
        this.name = data.name || "";
        this.nickname = data.nickname || "";
        this.picture = data.picture || "";
        this.preferred_username = data.preferred_username || "";
        this.profile = data.profile || "";
        this.sub = data.sub || "";
        this.premium = data.premium || false;
        this.idVerified = data.idVerified || false;
        this.interests = interests || [];
    }


}