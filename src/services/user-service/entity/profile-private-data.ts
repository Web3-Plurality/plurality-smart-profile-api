import { MerkleValueWithSalt } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { UserProfile } from "../../oauth-service/entity/user-profile";


interface LinkedAddress {
    chainName: string;
    chainId: number;
    address: string;
  }

export class AttestCred {
    interests: string[];
    reputationTags: string[];
    badges: string[];
    collections: string[];
    attestation : any;

    constructor(data: UserProfile) {
        this.interests = data?.interests || [];
        this.reputationTags = data?.reputationTags || [];
        this.badges = data?.badges || [];
        this.collections = data?.collections || [];
        this.attestation ={}
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

}

export class AttestedPlatformIds {
    platformType: string;
    username: string;
    attestation : any;

    constructor() {
        this.platformType = "";
        this.username = "";
        this.attestation = {}
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
}




export class ProfilePrivateData {
  attestedCred: AttestCred;
  attestedPlatformIds: AttestedPlatformIds;
  linkedAddress: LinkedAddress[];
  extendedPrivateData: string;
  
  

  constructor(data: UserProfile) {
    this.attestedCred = new AttestCred(data);
    this.attestedPlatformIds = new AttestedPlatformIds();
    this.linkedAddress = [];
    this.extendedPrivateData = "";
  }



    attestationCredSchema(): MerkleValueWithSalt[] {
      const salt = ethers.hexlify(ethers.randomBytes(32));
      return [
        { name: 'interests', value: JSON.stringify(this.attestedCred.interests), type: 'string',salt },
        { name: 'reputationTags', value: JSON.stringify(this.attestedCred.reputationTags), type: 'string',salt },
        { name: 'badges', value: JSON.stringify(this.attestedCred.badges), type: 'string',salt },
        { name: 'collections', value: JSON.stringify(this.attestedCred.collections), type: 'string',salt },
      ];
    }


    
    attestationPlatformIdSchema(): MerkleValueWithSalt[] {
        const salt = ethers.hexlify(ethers.randomBytes(32));
        return [
          { name: this.attestedPlatformIds.platformType, value: JSON.stringify(this.attestedPlatformIds.username), type: 'string',salt },
        ];
      }

}