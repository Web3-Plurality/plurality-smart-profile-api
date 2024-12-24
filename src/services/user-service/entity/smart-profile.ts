import { MerkleValue, MerkleValueWithSalt } from '@ethereum-attestation-service/eas-sdk';
import { ScoreTypes } from '../../../utils/global';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { ProfilePrivateData } from './profile-private-data';
dotenv.config();

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


export class SmartProfile {
  username: string;
  avatar: string;
  bio: string;
  scores: Score[];// attest
  extra: Extra[];
  connectedProfiles: ConnectedProfiles[];// attest
  connectedPlatforms: string[];
  profileTypeStreamId: string; // when should we have to put this
  version: string; // when should we have to put this
  extendedPublicData: any;
  attestation: any;
  privateData: ProfilePrivateData;
  
  

  constructor(data: any) {
    this.username = data?.username || '';
    this.avatar = data?.avatar || '';
    this.bio = data?.bio || '';
    this.extra = data?.extra || [];
    this.connectedProfiles = data?.connected_profiles || [];
    this.connectedPlatforms = data?.connected_platforms || []; // ask
    this.profileTypeStreamId  = '';
    this.version = process.env.SMART_PROFILE_VERSION || '1';
    this.attestation = data?.attestation || {};
    this.scores = Object.values(ScoreTypes).map((scoreType) => ({
      scoreType: scoreType,
      scoreValue: 0,
    }));
    this.privateData = new ProfilePrivateData(data);
  }

  // You can add methods to manipulate or retrieve the data here
  aggregateProfile(user: SmartProfile) {
    this.privateData.attestedCred.collections = this.privateData.attestedCred.collections.concat(user.privateData.attestedCred.collections);
    this.privateData.attestedCred.interests = this.privateData.attestedCred.interests.concat(user.privateData.attestedCred.interests);
    this.privateData.attestedCred.reputationTags = this.privateData.attestedCred.reputationTags.concat(user.privateData.attestedCred.reputationTags);
    this.privateData.attestedCred.badges = this.privateData.attestedCred.badges.concat(user.privateData.attestedCred.badges);
    this.extra = this.extra.concat(user.extra);
    this.privateData.linkedAddress = this.privateData.linkedAddress.concat(user.privateData.linkedAddress);
    const newProfile = user.connectedProfiles.filter((profile) => !this.connectedProfiles.includes(profile));
    this.connectedProfiles = this.connectedProfiles.concat(newProfile);
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




  attestationSchemaScore(): MerkleValueWithSalt[] {
    const merkleScore : MerkleValueWithSalt[] =  this.scores.map((s, i) => {
      // Generate random bytes
      const salt = ethers.hexlify(ethers.randomBytes(32));
      return ({ name: `score${i}`, value: JSON.stringify(s), type: 'string', salt})
    })

    return merkleScore
  }

  attestationSchemaConnectedProfiles(): MerkleValueWithSalt[] {
    return this.connectedProfiles.map((p, i) => {
      // Generate random bytes
      const salt = ethers.hexlify(ethers.randomBytes(32));
      return ({ name: p.platformName, value: JSON.stringify({...p,salt}), type: 'string', salt: salt })
    })
  }

  
}
