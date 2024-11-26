import {
  EAS,
  MerkleValue,
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
export async function offchainAttestations(user: MerkleValue[], address: string) {
  try {
    const EASContractAddress = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'; // Sepolia v0.26
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);
    const privateKey: string = process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '';
    const provider = ethers.getDefaultProvider('https://eth-sepolia.g.alchemy.com/v2/-Wu369VGLVlWnEt3VXbHLUoJxzkJzwi7');
    const signer: any = new ethers.Wallet(privateKey, provider);
    eas.connect(signer);
    const privateData = new PrivateData(user);
    const fullTree = privateData.getFullTree();
    const offchain = await eas.getOffchain();
    const schemaEncoder = new SchemaEncoder('bytes32 privateData');
    const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
    // Private data schema
    const schemaUID = '0x20351f973fdec1478924c89dfa533d8f872defa108d9c3c6512267d7e7e5dbc2';
    // Signer is an ethers.js Signer instance
    const offchainAttestation: any = await offchain.signOffchainAttestation(
      {
        recipient: address, // address of the recipient
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
// attest profile
export async function attestProfile(id: string, profile: SmartProfile | UserProfile, userAddress: string) {
  const attestation = await offchainAttestations(profile.attestationSchema(), userAddress);
  Logger.info(`profile attestated successfully for user id: ${id}`);
  return attestation;
}
// verifying attestation
export async function verifyOffcahinAttestation(attestation: any) {
  try {
    const EASContractAddress = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'; // Sepolia v0.26
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
