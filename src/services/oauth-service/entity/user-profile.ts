import { MerkleValue } from "@ethereum-attestation-service/eas-sdk";

interface Score {
  scoreType: string;
  scoreValue: number;
}

interface Extra {
  field: string;
  value: number;
}

interface LinkedAddress {
  chain_name: string;
  chain_id: number;
  address: string;
}

export class UserProfile {
  username: string;
  avatar: string;
  bio: string;
  interests: string[];
  scores: Score[];
  reputation_tags: string[];
  badges: string[];
  collections: string[];
  extra: Extra[];
  linked_address: LinkedAddress[];
  attestation: any;

  constructor(
    username?: string,
    avatar?: string,
    bio?: string,
    interests: string[] = [],
    scores: Score[] = [],
    reputation_tags: string[] = [],
    badges: string[] = [],
    collections: string[] = [],
    extra: Extra[] = [],
    linked_address: LinkedAddress[] = [],
    attestation:any = {}
  ) {
    this.username = username || '';
    this.avatar = avatar || '';
    this.bio = bio || '';
    this.interests = interests || [];
    this.scores = scores;
    this.reputation_tags = reputation_tags;
    this.badges = badges;
    this.collections = collections;
    this.extra = extra;
    this.linked_address = linked_address;
    this.attestation = attestation || {};
  }

  setAttestation(attestation: any) {
    this.attestation = {
        version: attestation?.version,
        uid: attestation?.uid,
        domain:{
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
            salt: attestation?.message?.salt 
        },
        types: attestation?.types,
        signature:attestation?.signature
    };
}

attestationSchema(): MerkleValue[] {
    return( [
      { name: "username", value: this.username, type: "string" },
      { name: "avatar", value: this.avatar, type: "string" },
      { name: "bio", value: this.bio, type: "string" },
      { name: "interests", value: JSON.stringify(this.interests), type: "string" },
      { name: "scores", value: JSON.stringify(this.scores), type: "string" },
      { name: "reputation_tags", value: JSON.stringify(this.reputation_tags), type: "string" },
      { name: "badges", value: JSON.stringify(this.badges), type: "string" },
      { name: "collections", value: JSON.stringify(this.collections), type: "string" },
      { name: "extra", value: JSON.stringify(this.extra), type: "string" },
      { name: "linked_address", value: JSON.stringify(this.linked_address), type: "string" },
    ]);
  }

  // // You can add methods to manipulate or retrieve the data here
  // aggregateProfile(user: UserProfile){
  //     this.collections = this.collections.concat(user.collections);
  //     this.interests = this.interests.concat(user.interests);
  //     this.reputation_tags = this.reputation_tags.concat(user.reputation_tags);
  //     this.badges = this.badges.concat(user.badges);
  //     this.extra = this.extra.concat(user.extra);
  //     this.linked_address = this.linked_address.concat(user.linked_address);
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
