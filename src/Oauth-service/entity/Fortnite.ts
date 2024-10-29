export class FortniteProfile {
    displayName: string;
    accountId: string;
    preferredLanguage: string;

    constructor(data: any = {}) {
        this.displayName = data?.displayName || "";
        this.accountId = data?.accountId || "";
        this.preferredLanguage = data?.preferredLanguage || "";
    }
}