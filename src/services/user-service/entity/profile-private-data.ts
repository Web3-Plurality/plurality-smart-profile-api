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

interface ExtendedPrivateData {
  field: string;
  value: string;
}

interface CredSalts {
  interests: string;
  reputationTags: string;
  badges: string;
  collections: string;
}

export class AttestCred {
  interests: string[];
  reputationTags: string[];
  badges: string[];
  collections: string[];
  attestation: any;
  salt: CredSalts;

  constructor() {
    this.interests = [];
    this.reputationTags = [];
    this.badges = [];
    this.collections = [];
    this.attestation = {};
    this.salt = {
      interests: '',
      reputationTags: '',
      badges: '',
      collections: '',
    };
  }
}

export class AttestedPlatformIds {
  connectedProfiles: ConnectedProfiles[];
  attestation: any;
  salt: any;
  constructor() {
    this.connectedProfiles = [];
    this.attestation = {};
    this.salt = {};
  }
}

export class ProfilePrivateData {
  attestedCred: AttestCred;
  attestedPlatformIds: AttestedPlatformIds;
  linkedAddress: LinkedAddress[];
  extendedPrivateData: ExtendedPrivateData[];

  constructor() {
    this.attestedCred = new AttestCred();
    this.attestedPlatformIds = new AttestedPlatformIds();
    this.linkedAddress = [];
    this.extendedPrivateData = [];
  }
}
