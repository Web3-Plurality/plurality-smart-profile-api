import { MerkleValue } from '@ethereum-attestation-service/eas-sdk';

interface Score {
  scoreType: string;
  scoreValue: number;
}

interface Extra {
  field: string;
  value: number;
}

interface LinkedAddress {
  chainName: string;
  chainId: number;
  address: string;
}

export class UserProfile {
  username: string;
  avatar: string;
  bio: string;
  interests: string[];
  scores: Score[];
  reputationTags: string[];
  badges: string[];
  collections: string[];
  extra: Extra[];
  linkedAddress: LinkedAddress[];
  attestation: any;

  constructor(
    username?: string,
    avatar?: string,
    bio?: string,
    interests: string[] = [],
    scores: Score[] = [],
    reputationTags: string[] = [],
    badges: string[] = [],
    collections: string[] = [],
    extra: Extra[] = [],
    linkedAddress: LinkedAddress[] = [],
    attestation: any = {},
  ) {
    this.username = username || '';
    this.avatar = avatar || '';
    this.bio = bio || '';
    this.interests = interests || [];
    this.scores = scores;
    this.reputationTags = reputationTags;
    this.badges = badges;
    this.collections = collections;
    this.extra = extra;
    this.linkedAddress = linkedAddress;
    this.attestation = attestation || {};
  }

  setAttestation(attestation: any) {
    this.attestation = {
      version: attestation?.version,
      uid: attestation?.uid,
      domain: {
        name: attestation?.domain?.name,
        version: attestation?.domain?.version,
        chainId: attestation?.domain?.chainId?.toString(),
        verifyingContract: attestation?.domain?.verifyingContract,
      },
      primaryType: attestation?.primaryType,
      message: {
        version: attestation?.message?.version,
        recipient: attestation?.message?.recipient,
        expirationTime: attestation?.message?.expirationTime?.toString(),
        time: attestation?.message?.time?.toString(),
        revocable: attestation?.message?.revocable,
        schema: attestation?.message?.schema,
        refUID: attestation?.message?.refUID,
        data: attestation?.message?.data,
        salt: attestation?.message?.salt,
      },
      types: attestation?.types,
      signature: attestation?.signature,
    };
  }

  attestationSchema(): MerkleValue[] {
    return [
      // { name: 'username', value: this.username, type: 'string' },
      // { name: 'avatar', value: this.avatar, type: 'string' },
      // { name: 'bio', value: this.bio, type: 'string' },
      { name: 'interests', value: JSON.stringify(this.interests), type: 'string' },
      { name: 'scores', value: JSON.stringify(this.scores), type: 'string' },
      { name: 'reputationTags', value: JSON.stringify(this.reputationTags), type: 'string' },
      { name: 'badges', value: JSON.stringify(this.badges), type: 'string' },
      { name: 'collections', value: JSON.stringify(this.collections), type: 'string' },
      // { name: 'extra', value: JSON.stringify(this.extra), type: 'string' },
      // { name: 'linkedAddress', value: JSON.stringify(this.linkedAddress), type: 'string' },
    ];
  }

  // // You can add methods to manipulate or retrieve the data here
  // aggregateProfile(user: UserProfile){
  //     this.collections = this.collections.concat(user.collections);
  //     this.interests = this.interests.concat(user.interests);
  //     this.reputation_tags = this.reputation_tags.concat(user.reputation_tags);
  //     this.badges = this.badges.concat(user.badges);
  //     this.extra = this.extra.concat(user.extra);
  //     this.linkedAddress = this.linkedAddress.concat(user.linkedAddress);
  //     // if score value is match then add the value
  //     const updatedScores = this.scores.map(score => {
  //         const userScore = user.scores.find(us => us.scoreType === score.scoreType);
  //         if (userScore) {
  //             return {
  //                 ...score,
  //                 scoreValue: score.scoreValue + userScore.scoreValue
  //             };
  //         }
  //         return score;
  //     });
  //     // update the score
  //     this.scores = updatedScores

  // }
}
