import {
  EAS,
  MerkleValueWithSalt,
  Offchain,
  OffchainAttestationVersion,
  OffchainConfig,
  PrivateData,
  SchemaEncoder,
} from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import Logger from '../../../lib/logger';
import { SmartProfile } from '../entity/smart-profile';
import { AttestCred, AttestedPlatformIds } from '../entity/profile-private-data';
import { plainToInstance } from 'class-transformer';

// creates offchain attestation of private data using merkle root based on EAS's published private data schema
export async function privateOffchainAttestations(merkleObj: MerkleValueWithSalt[], userAddress: string) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x';
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const provider = ethers.getDefaultProvider(process.env.EAS_BLOCKCHAIN_RPC || '');
    const signer: any = new ethers.Wallet(privateKey, provider);
    eas.connect(signer);
    const privateData = new PrivateData(merkleObj);
    const fullTree = privateData.getFullTree();
    const schemaEncoder = new SchemaEncoder('bytes32 privateData');
    const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
    const schemaUID = process.env.PRIVATE_SCHEMA_UID || '';
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

// creates offchain attestation of public data using smart profile based on Plurality's published smart profile schema
export async function publicOffchainAttestation(profile: SmartProfile, userAddress: string) {
  const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x'; // Sepolia v0.26
  // Initialize the sdk with the address of the EAS Schema contract address
  const eas = new EAS(EASContractAddress);
  const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
  const provider = ethers.getDefaultProvider(process.env.EAS_BLOCKCHAIN_RPC);
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

// verify offchain  public/private attestaion
export async function verifyOffchainAttestation(attestation: any) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x';
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const EAS_CONFIG: OffchainConfig = {
      address: attestation.domain.verifyingContract,
      version: attestation.domain.version,
      chainId: BigInt(attestation.domain.chainId),
    };
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const provider = ethers.getDefaultProvider(process.env.EAS_BLOCKCHAIN_RPC);
    const signer: any = new ethers.Wallet(privateKey, provider);
    const signerAddress = await signer.getAddress()
    const offchain = new Offchain(EAS_CONFIG, OffchainAttestationVersion.Version2, eas);
    const isValidAttestation = offchain.verifyOffchainAttestationSignature(signerAddress, attestation);
    return isValidAttestation;
  } catch (error) {
    Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
    return false;
  }
}

// Typecasts attestedCred or attestedPlatformIds Object to MerkleValueWithSalt to create private data attestation
export function toMerkleValueWithSalt(
  attestationObj: AttestCred | AttestedPlatformIds,
  verification = false,
): MerkleValueWithSalt[] {
  if (attestationObj instanceof AttestCred) {
    let salt1 = '';
    let salt2 = '';
    let salt3 = '';
    let salt4 = '';
    if (
      attestationObj?.interests?.length === 0 &&
      attestationObj?.reputationTags?.length === 0 &&
      attestationObj?.badges?.length === 0 &&
      attestationObj?.collections?.length === 0
    ) {
      return [];
    }
    if (verification) {
      // verification workflow - we use existing salts from the object
      salt1 = attestationObj.salt?.interests;
      salt2 = attestationObj.salt?.reputationTags;
      salt3 = attestationObj.salt?.badges;
      salt4 = attestationObj.salt?.collections;
    } else {
      // attestation workflow - generate new salts
      salt1 = ethers.hexlify(ethers.randomBytes(32));
      salt2 = ethers.hexlify(ethers.randomBytes(32));
      salt3 = ethers.hexlify(ethers.randomBytes(32));
      salt4 = ethers.hexlify(ethers.randomBytes(32));
      // saving salts
      attestationObj.salt.interests = salt1;
      attestationObj.salt.reputationTags = salt2;
      attestationObj.salt.badges = salt3;
      attestationObj.salt.collections = salt4;
    }
    return [
      {
        name: 'interests',
        value: JSON.stringify(attestationObj.interests),
        type: 'string',
        salt: salt1,
      },
      {
        name: 'reputationTags',
        value: JSON.stringify(attestationObj.reputationTags),
        type: 'string',
        salt: salt2,
      },
      {
        name: 'badges',
        value: JSON.stringify(attestationObj.badges),
        type: 'string',
        salt: salt3,
      },
      {
        name: 'collections',
        value: JSON.stringify(attestationObj.collections),
        type: 'string',
        salt: salt4,
      },
    ];
  } else if (attestationObj instanceof AttestedPlatformIds) {
    const platformIdSchema = attestationObj.connectedProfiles.map((profile: any) => {
      let salt = '';
      if (verification) {
        // verification workflow - we use existing salts from the object
        salt = attestationObj.salt[profile.platformType];
      } else {
        // attestation workflow - generate new salts
        salt = ethers.hexlify(ethers.randomBytes(32));
        // saving salts
        attestationObj.salt[profile.platformType] = salt;
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
  throw new Error('Invalid attestationObj type');
}

// parse individual attestation values to string due to large bigint non serializable by json
export function parseAttestation(attestation: any) {
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

// verify and validate Creds attestation
export async function verifyCredAttestation(attestedCred: AttestCred) {
  // check attestation exist or not
  if (attestedCred?.attestation && Object.keys(attestedCred?.attestation)?.length > 0) {
    const isValidCredAttestation = await verifyOffchainAttestation(attestedCred?.attestation);
    if (isValidCredAttestation) {
      const credSchema = toMerkleValueWithSalt(attestedCred, true);
      if (credSchema?.length > 0) {
        const privateData = new PrivateData(credSchema);
        const fullTree = privateData.getFullTree();
        const schemaEncoder = new SchemaEncoder('bytes32 privateData');
        const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
        const isValid = attestedCred.attestation.message.data === encodedData;
        return isValid;
      } else {
        Logger.error('something wrong in the merkel Cred Data.');
        return false;
      }
    } else {
      Logger.error('Attestation is not valid');
      return false;
    }
  } else {
    // attestation not exist
    Logger.info('attestaion does not exist.');
    return true;
  }
}
// verify and validate PlatformIds attestation
export async function verifyPlatfomIdAttestation(attestedPlatformIds: AttestedPlatformIds) {
  // check attestation exist or not
  if (attestedPlatformIds?.attestation && Object.keys(attestedPlatformIds?.attestation)?.length > 0) {
    const isValidPlatformIdsAttestation = await verifyOffchainAttestation(attestedPlatformIds?.attestation);
    if (isValidPlatformIdsAttestation) {
      const platfomSchema = toMerkleValueWithSalt(attestedPlatformIds, true);
      if (platfomSchema?.length > 0) {
        const privateData = new PrivateData(platfomSchema);
        const fullTree = privateData.getFullTree();
        const schemaEncoder = new SchemaEncoder('bytes32 privateData');
        const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
        const isValid = attestedPlatformIds.attestation.message.data === encodedData;
        return isValid;
      } else {
        Logger.error('something wrong in the merkel PlatformIds Data.');
        return false;
      }
    } else {
      Logger.error('Attestation is not valid');
      return false;
    }
  } else {
    // attestation not exist
    Logger.info('attestaion does not exist.');
    return true;
  }
}
