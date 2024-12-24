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
import { UserProfile } from '../entity/user-profile';
import { SmartProfile } from '../../user-service/entity/smart-profile';

// profile Offchainattestation
export async function privateOffchainAttestations(schema: MerkleValueWithSalt[], userAddress: string) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || "0x"; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const provider = ethers.getDefaultProvider(process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '');
    const signer: any = new ethers.Wallet(privateKey, provider);
    eas.connect(signer);
    const privateData = new PrivateData(schema);
    const fullTree = privateData.getFullTree();
    const schemaEncoder = new SchemaEncoder("bytes32 privateData");
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
  
  const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || "0x"; // Sepolia v0.26
  // Initialize the sdk with the address of the EAS Schema contract address
  const eas = new EAS(EASContractAddress);
  const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
  const provider = ethers.getDefaultProvider(process.env.SEPOLIA_RPC);
  const signer: any = new ethers.Wallet(privateKey, provider);
  eas.connect(signer);
  const offchain = await eas.getOffchain();
  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder("string username,string bio,string avatar,string scores,string connectedPlatforms,string profileTypeStreamId,uint256 version,string extendedPublicData");
  const schemaUID = process.env.PUBLIC_SCHEMA_UID || ""
  const encodedData = schemaEncoder.encodeData([
    { name: "username", value: profile.username, type: "string" },
    { name: "bio", value: profile.bio, type: "string" },
    { name: "avatar", value: profile.avatar, type: "string" },
    { name: "scores", value: JSON.stringify(profile.scores), type: "string" },
    { name: "connectedPlatforms", value: JSON.stringify(profile.connectedPlatforms), type: "string" },
    { name: "profileTypeStreamId", value: profile.profileTypeStreamId, type: "string" },
    { name: "version", value: profile.version, type: "uint256" },
    { name: "extendedPublicData", value: JSON.stringify(profile.extendedPublicData), type: "string" },
  ]);

  const offchainAttestation: any = await offchain.signOffchainAttestation(
    {
      recipient: userAddress,// this can be empty
      expirationTime: BigInt(0), // Unix timestamp of when attestation expires (0 for no expiration)
      time: BigInt(Math.floor(Date.now() / 1000)), // Unix timestamp of current time
      revocable: false, // Be aware that if your schema is not revocable, this MUST be false
      schema: schemaUID,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data: encodedData
    },
    signer
  );

  console.log(offchainAttestation);
  profile.setAttestation(offchainAttestation);

}


// attest profile
export async function attestProfile(id: string, profile: SmartProfile, userAddress: string) {
  //Public attestation
  const publicAttestation = await publicOffchainAttestation(profile, userAddress);
  profile.setAttestation(publicAttestation)
  Logger.info(`public Data of profile attested successfully for user id: ${id}`);

  const credAttestation = await privateOffchainAttestations(profile.privateData.attestationCredSchema(), userAddress);
  profile.privateData.attestedCred.setAttestation(credAttestation)
  Logger.info(`private Cred Data of profile attested successfully for user id: ${id}`);

  const platformIdsAttestation = await privateOffchainAttestations(profile.privateData.attestationPlatformIdSchema(), userAddress);
  profile.privateData.attestedPlatformIds.setAttestation(platformIdsAttestation)
  Logger.info(`private platformIds Data of profile attested successfully for user id: ${id}`);

  
}
// verifying attestation
export async function verifyOffcahinAttestation(attestation: any) {
  try {
    const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || "0x"; // Sepolia v0.26
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

// export function verifyAttestedData(profile: SmartProfile | UserProfile): boolean {
//   try {
//     const privateData = new PrivateData(profile.attestationSchema());
//     const proofIndexes = [0, 1, 2]; // interests, scores, tags
//     const multiProof = privateData.generateMultiProof(proofIndexes);

//     const schemaEncoder = new SchemaEncoder("bytes32 privateData");
//     const decodedData = schemaEncoder.decodeData(profile?.attestation?.message?.data);

//     console.log("dddddddddddddddd", decodedData[0]?.value?.value)
//     // console.log("",multiProof)
//     console.log("aaa", profile.attestationSchema())
//     // To verify a multi-proof against a known Merkle root:
//     const isValid = PrivateData.verifyMultiProof(decodedData[0]?.value?.value, multiProof);
//     console.log('Is Multi-Proof Valid?', isValid);
//     console.log("profile?.attestation?.data", decodedData[0]?.value?.value)
//     return isValid;
//   } catch (error) {
//     Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
//     return false;
//   }
// }
