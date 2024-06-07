export class RobloxProfile {
    created_at: number;
    name: string;
    nickname: string;
    picture: string;
    preferred_username: string;
    profile: string;
    sub: string;

    constructor(data: any = {}) {
        this.created_at = data.created_at || 0;
        this.name = data.name || "";
        this.nickname = data.nickname || "";
        this.picture = data.picture || "";
        this.preferred_username = data.preferred_username || "";
        this.profile = data.profile || "";
        this.sub = data.sub || "";
    }


}