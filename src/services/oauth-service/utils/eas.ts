import {
  EAS,
  MerkleValue,
  MerkleValueWithSalt,
  Offchain,
  OffchainAttestationVersion,
  OffchainConfig,
  PrivateData,
  SchemaEncoder,
} from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import Logger from '../../../lib/logger';
import { SmartProfile } from '../../user-service/entity/smart-profile';

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
    const schemaUID = '0x20351f973fdec1478924c89dfa533d8f872defa108d9c3c6512267d7e7e5dbc2';
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

// attest profile
export async function attestProfile(id: string, profile: SmartProfile, userAddress: string) {
  //Public attestation
  const publicAttestation = await publicOffchainAttestation(profile, userAddress);
  profile.setAttestation(publicAttestation);
  Logger.info(`public Data of profile attested successfully for user id: ${id}`);
  console.log("aaaaaaa",JSON.stringify(profile.privateData))
  //private data attestation
  const credSchema = attestationCredSchema(profile);
  if (credSchema?.length > 0) {
    const credAttestation = await privateOffchainAttestations(credSchema, userAddress);
    profile.privateData.attestedCred.attestation = setAttestation(credAttestation);
    Logger.info(`private Cred Data of profile attested successfully for user id: ${id}`)
  }

  const platformIdSchema = attestationPlatformIdSchema(profile);
  if (platformIdSchema?.length > 0) {  
    const platformIdsAttestation = await privateOffchainAttestations(
      platformIdSchema,
      userAddress,
    );
    profile.privateData.attestedPlatformIds.attestation = setAttestation(platformIdsAttestation);
    Logger.info(`private platformIds Data of profile attested successfully for user id: ${id}`);
  }
return profile
}
// verifying attestation
export async function verifyOffcahinAttestation(attestation: any) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x'; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const signer: any = new ethers.Wallet(privateKey);
    const EAS_CONFIG: OffchainConfig = {
      address: attestation.domain.verifyingContract,
      version: attestation.domain.version,
      chainId: BigInt(attestation.domain.chainId),
    };
    const signerAddress = await signer.getAddress();
    const offchain = new Offchain(EAS_CONFIG, OffchainAttestationVersion.Version2, eas);
    const isValidAttestation = offchain.verifyOffchainAttestationSignature(signerAddress, attestation);
    return isValidAttestation;
  } catch (error) {
    Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
    return false;
  }
}

export function verifyPublicAttestedData(profile: SmartProfile): boolean {
  try {
    const schemaEncoder = new SchemaEncoder(
      'string username,string bio,string avatar,string scores,string connectedPlatforms,string profileTypeStreamId,string version',
    );
    const encodedData = schemaEncoder.encodeData([
      { name: 'username', value: profile.username, type: 'string' },
      { name: 'bio', value: profile.bio, type: 'string' },
      { name: 'avatar', value: profile.avatar, type: 'string' },
      { name: 'scores', value: JSON.stringify(profile.scores), type: 'string' },
      { name: 'connectedPlatforms', value: JSON.stringify(profile.connectedPlatforms), type: 'string' },
      { name: 'profileTypeStreamId', value: profile.profileTypeStreamId, type: 'string' },
      { name: 'version', value: JSON.stringify(profile.version), type: 'string' },
    ]);
    
    return profile?.attestation?.message?.data === encodedData;
  } catch (error) {
    Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
    return false;
  }
}


export function verifyPrivateAttestedData(profile: SmartProfile): boolean {
  try {

    const credSchema = attestationCredSchema(profile);
    const platfomSchema = attestationPlatformIdSchema(profile)
    let validCredsData = false
    let validPlatformsData = false
    //validating crerds data
    if (credSchema?.length > 0) {
      const privateData = new PrivateData(credSchema);
      const fullTree = privateData.getFullTree();
      const schemaEncoder = new SchemaEncoder('bytes32 privateData');
      const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
      validCredsData = profile.privateData.attestedCred.attestation.message.data === encodedData
    } else{
      //if no data then dont need to validate it
      validCredsData =true
    }
    //validating platform data
    if (platfomSchema?.length > 0) {
      const privateData = new PrivateData(platfomSchema);
      const fullTree = privateData.getFullTree();
      const schemaEncoder = new SchemaEncoder('bytes32 privateData');
      const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
      validPlatformsData = profile.privateData.attestedPlatformIds.attestation.message.data === encodedData
    } else{
      //if no data then dont need to validate it
      validPlatformsData =true
    }

    return validPlatformsData && validCredsData;
  } catch (error) {
    Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
    return false;
  }
}

// Schema Generation
function attestationCredSchema(smartProfile: SmartProfile): MerkleValueWithSalt[] {
  let salt = ""
  if(smartProfile.privateData.attestedCred.salt){
    salt = smartProfile.privateData.attestedCred.salt
  }
  else{
     salt = ethers.hexlify(ethers.randomBytes(32));
     smartProfile.privateData.attestedCred.salt = salt
  }
  return [
    { name: 'interests', value: JSON.stringify(smartProfile.privateData.attestedCred.interests), type: 'string', salt },
    { name: 'reputationTags', value: JSON.stringify(smartProfile.privateData.attestedCred.reputationTags), type: 'string', salt },
    { name: 'badges', value: JSON.stringify(smartProfile.privateData.attestedCred.badges), type: 'string', salt },
    { name: 'collections', value: JSON.stringify(smartProfile.privateData.attestedCred.collections), type: 'string', salt },
  ];
}

function attestationPlatformIdSchema  (smartProfile: SmartProfile): MerkleValueWithSalt[]   {
  let salt = ""
  if(smartProfile.privateData.attestedPlatformIds.salt){
    salt = smartProfile.privateData.attestedPlatformIds.salt
  }
  else{
     salt = ethers.hexlify(ethers.randomBytes(32));
     smartProfile.privateData.attestedPlatformIds.salt = salt
  }
  const platformIdSchema =  smartProfile.privateData.attestedPlatformIds.connectedProfiles.map((profile)=>{
    return {
        name: profile.platformType,
        value: JSON.stringify(profile),
        type: 'string',
        salt,
    }
  })

return platformIdSchema;
}


function setAttestation(attestation: any) {
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