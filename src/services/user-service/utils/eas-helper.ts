import { EAS, MerkleValueWithSalt, PrivateData, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import Logger from '../../../lib/logger';
import { SmartProfile } from '../entity/smart-profile';

// profile Offchainattestation
export async function privateOffchainAttestations(schema: MerkleValueWithSalt[], userAddress: string) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x'; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const provider = ethers.getDefaultProvider(process.env.SEPOLIA_RPC || '');
    const signer: any = new ethers.Wallet(privateKey, provider);
    eas.connect(signer);
    const privateData = new PrivateData(schema);
    const fullTree = privateData.getFullTree();
    const schemaEncoder = new SchemaEncoder('bytes32 privateData');
    const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
    const schemaUID = process.env.PRIVATE_SCHEMA_UID;
    const offchain = await eas.getOffchain();

    const offchainAttestation: any = await offchain.signOffchainAttestation(
      {
        recipient: userAddress, // address of the recipient
        expirationTime: BigInt(0), // Unix timestamp of when attestation expires (0 for no expiration)
        time: BigInt(Math.floor(Date.now() / 1000)), // Unix timestamp of current time
        revocable: false, // Be aware that if your schema is not revocable, this MUST be false
        schema: schemaUID,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        data: encodedData,
      },
      signer,
    );

    return offchainAttestation;
  } catch (error) {
    Logger.error(`error occur while doing offchain attestation ${JSON.stringify(error)}`);
    return {};
  }
}

export async function publicOffchainAttestation(profile: SmartProfile, userAddress: string) {
  const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x'; // Sepolia v0.26
  // Initialize the sdk with the address of the EAS Schema contract address
  const eas = new EAS(EASContractAddress);
  const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
  const provider = ethers.getDefaultProvider(process.env.SEPOLIA_RPC);
  const signer: any = new ethers.Wallet(privateKey, provider);
  eas.connect(signer);
  const offchain = await eas.getOffchain();
  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder(
    'string username,string bio,string avatar,string scores,string connectedPlatforms,string profileTypeStreamId,string version',
  );
  const schemaUID = process.env.PUBLIC_SCHEMA_UID || '';
  const encodedData = schemaEncoder.encodeData([
    { name: 'username', value: profile.username, type: 'string' },
    { name: 'bio', value: profile.bio, type: 'string' },
    { name: 'avatar', value: profile.avatar, type: 'string' },
    { name: 'scores', value: JSON.stringify(profile.scores), type: 'string' },
    { name: 'connectedPlatforms', value: JSON.stringify(profile.connectedPlatforms), type: 'string' },
    { name: 'profileTypeStreamId', value: profile.profileTypeStreamId, type: 'string' },
    { name: 'version', value: JSON.stringify(profile.version), type: 'string' },
  ]);

  const offchainAttestation: any = await offchain.signOffchainAttestation(
    {
      recipient: userAddress, // this can be empty
      expirationTime: BigInt(0), // Unix timestamp of when attestation expires (0 for no expiration)
      time: BigInt(Math.floor(Date.now() / 1000)), // Unix timestamp of current time
      revocable: false, // Be aware that if your schema is not revocable, this MUST be false
      schema: schemaUID,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data: encodedData,
    },
    signer,
  );
  return offchainAttestation;
}

// Schema Generation
export function attestationCredSchema(smartProfile: SmartProfile, verification = false): MerkleValueWithSalt[] {
  let salt1 = '';
  let salt2 = '';
  let salt3 = '';
  let salt4 = '';

  if (verification) {
    salt1 = smartProfile.privateData.attestedCred.salt?.interests;
    salt2 = smartProfile.privateData.attestedCred.salt?.reputationTags;
    salt3 = smartProfile.privateData.attestedCred.salt?.badges;
    salt4 = smartProfile.privateData.attestedCred.salt?.collections;
  } else {
    // generate new salts for attestation
    salt1 = ethers.hexlify(ethers.randomBytes(32));
    salt2 = ethers.hexlify(ethers.randomBytes(32));
    salt3 = ethers.hexlify(ethers.randomBytes(32));
    salt4 = ethers.hexlify(ethers.randomBytes(32));
    // saving salts
    smartProfile.privateData.attestedCred.salt.interests = salt1;
    smartProfile.privateData.attestedCred.salt.reputationTags = salt2;
    smartProfile.privateData.attestedCred.salt.badges = salt3;
    smartProfile.privateData.attestedCred.salt.collections = salt4;
  }
  return [
    {
      name: 'interests',
      value: JSON.stringify(smartProfile.privateData.attestedCred.interests),
      type: 'string',
      salt: salt1,
    },
    {
      name: 'reputationTags',
      value: JSON.stringify(smartProfile.privateData.attestedCred.reputationTags),
      type: 'string',
      salt: salt2,
    },
    {
      name: 'badges',
      value: JSON.stringify(smartProfile.privateData.attestedCred.badges),
      type: 'string',
      salt: salt3,
    },
    {
      name: 'collections',
      value: JSON.stringify(smartProfile.privateData.attestedCred.collections),
      type: 'string',
      salt: salt4,
    },
  ];
}

export function attestationPlatformIdSchema(smartProfile: SmartProfile, verification = false): MerkleValueWithSalt[] {
  const platformIdSchema = smartProfile.privateData.attestedPlatformIds.connectedProfiles.map((profile: any) => {
    let salt = '';
    if (verification) {
      salt = smartProfile.privateData.attestedPlatformIds.salt[profile.platformType];
    } else {
      // generate new salt for attestation
      salt = ethers.hexlify(ethers.randomBytes(32));
      // saving salt
      smartProfile.privateData.attestedPlatformIds.salt[profile.platformType] = salt;
    }
    return {
      name: profile.platformType,
      value: JSON.stringify(profile),
      type: 'string',
      salt,
    };
  });

  return platformIdSchema;
}

export function setAttestation(attestation: any) {
  return {
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
