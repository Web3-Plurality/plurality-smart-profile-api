import { MerkleValue } from '@ethereum-attestation-service/eas-sdk';
import { ScoreTypes } from '../../../utils/global';

interface Score {
  scoreType: string;
  scoreValue: number;
}

interface ConnectedProfiles {
  platformName: string;
  userPlatformId: string | null;
  username?: string | null;
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

export class SmartProfile {
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
  connectedProfiles: ConnectedProfiles[];
  connectedPlatforms: string[];
  attestation: any;

  constructor(data: any) {
    this.username = data?.username || '';
    this.avatar = data?.avatar || '';
    this.bio = data?.bio || '';
    this.interests = data?.interests || [];
    this.reputationTags = data?.reputation_tags || [];
    this.badges = data?.badges || [];
    this.collections = data?.collections || [];
    this.extra = data?.extra || [];
    this.linkedAddress = data?.linked_address || [];
    this.connectedProfiles = data?.connected_profiles || [];
    this.connectedPlatforms = data?.connected_platforms || [];
    this.attestation = data?.attestation || {};
    this.scores = Object.values(ScoreTypes).map((scoreType) => ({
      scoreType: scoreType,
      scoreValue: 0,
    }));
  }

  // You can add methods to manipulate or retrieve the data here
  aggregateProfile(user: SmartProfile) {
    this.collections = this.collections.concat(user.collections);
    this.interests = this.interests.concat(user.interests);
    this.reputationTags = this.reputationTags.concat(user.reputationTags);
    this.badges = this.badges.concat(user.badges);
    this.extra = this.extra.concat(user.extra);
    this.linkedAddress = this.linkedAddress.concat(user.linkedAddress);
    if (user instanceof SmartProfile) {
      const newProfile = user.connectedProfiles.filter((profile) => !this.connectedProfiles.includes(profile));
      this.connectedProfiles = this.connectedProfiles.concat(newProfile);
    }
    const updatedScores = this.scores.map((score) => {
      const userScore = user.scores.find((us) => us.scoreType === score.scoreType);
      if (userScore) {
        return {
          ...score,
          scoreValue: score.scoreValue + userScore.scoreValue,
        };
      }
      return score;
    });
    // update the score
    this.scores = updatedScores;
  }

  updateScoreValue(scoreType: string, newValue: number) {
    this.scores = this.scores.map((score) => {
      if (score.scoreType === scoreType) {
        return {
          ...score,
          scoreValue: newValue,
        };
      }
      return score;
    });
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
      { name: 'username', value: this.username, type: 'string' },
      { name: 'avatar', value: this.avatar, type: 'string' },
      { name: 'bio', value: this.bio, type: 'string' },
      { name: 'interests', value: JSON.stringify(this.interests), type: 'string' },
      { name: 'scores', value: JSON.stringify(this.scores), type: 'string' },
      { name: 'reputationTags', value: JSON.stringify(this.reputationTags), type: 'string' },
      { name: 'badges', value: JSON.stringify(this.badges), type: 'string' },
      { name: 'collections', value: JSON.stringify(this.collections), type: 'string' },
      { name: 'extra', value: JSON.stringify(this.extra), type: 'string' },
      { name: 'linkedAddress', value: JSON.stringify(this.linkedAddress), type: 'string' },
      { name: 'connectedProfiles', value: JSON.stringify(this.connectedProfiles), type: 'string' },
      { name: 'connectedPlatforms', value: JSON.stringify(this.connectedPlatforms), type: 'string' },
    ];
  }
}
