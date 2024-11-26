export class SnapChatProfile {
  displayName: string;
  bitmoji: string;
  externalId: string;

  constructor(data: any = {}) {
    this.displayName = data?.me?.displayName || '';
    this.bitmoji = data?.me?.bitmoji?.avatar || '';
    this.externalId = data?.me?.externalId || '';
  }
}
