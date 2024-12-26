interface LinkedAddress {
  chainName: string;
  chainId: number;
  address: string;
}

interface ConnectedProfiles {
  platformType: string;
  userPlatformId: string;
  username?: string;
}

export class AttestCred {
  interests: string[];
  reputationTags: string[];
  badges: string[];
  collections: string[];
  attestation: any;
  salt: string

  constructor() {
    this.interests =  [];
    this.reputationTags =  [];
    this.badges = [];
    this.collections =  [];
    this.attestation = {};
    this.salt = ""
  }
}

export class AttestedPlatformIds {
 connectedProfiles : ConnectedProfiles[]
  attestation: any;
  salt : string;
  constructor() {
    this.connectedProfiles = [];
    this.attestation = {};
    this.salt = "";
  }
}

export class ProfilePrivateData {
  attestedCred: AttestCred;
  attestedPlatformIds: AttestedPlatformIds;
  linkedAddress: LinkedAddress[];
  extendedPrivateData: string;

  constructor() {
    this.attestedCred = new AttestCred();
    this.attestedPlatformIds = new AttestedPlatformIds();
    this.linkedAddress = [];
    this.extendedPrivateData = '';
  }
}
