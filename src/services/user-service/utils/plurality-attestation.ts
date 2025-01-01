import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import Logger from '../../../lib/logger';
import { SmartProfile } from '../entity/smart-profile';
import {
  toMerkleValueWithSalt,
  privateOffchainAttestations,
  publicOffchainAttestation,
  parseAttestation,
  verifyOffchainAttestation,
  verifyCredAttestation,
  verifyPlatfomIdAttestation,
} from './eas-helper';

// attest profile
export async function attestSmartProfile(id: string, profile: SmartProfile, userAddress: string) {
  //Public attestation
  const publicAttestation = await publicOffchainAttestation(profile, userAddress);
  profile.attestation = parseAttestation(publicAttestation);
  Logger.info(`public Data of profile attested successfully for user id: ${id}`);
  // profile.privateData.attestedCred = plainToInstance(AttestCred,profile.privateData.attestedCred)
  //private data attestation
  const credSchema = toMerkleValueWithSalt(profile.privateData.attestedCred, false);
  if (credSchema?.length > 0) {
    const credAttestation = await privateOffchainAttestations(credSchema, userAddress);
    profile.privateData.attestedCred.attestation = parseAttestation(credAttestation);
    Logger.info(`private Cred Data of profile attested successfully for user id: ${id}`);
  }
  const platformIdSchema = toMerkleValueWithSalt(profile.privateData.attestedPlatformIds, false);
  if (platformIdSchema?.length > 0) {
    const platformIdsAttestation = await privateOffchainAttestations(platformIdSchema, userAddress);
    profile.privateData.attestedPlatformIds.attestation = parseAttestation(platformIdsAttestation);
    Logger.info(`private platformIds Data of profile attested successfully for user id: ${id}`);
  }
  return profile;
}

export async function verifyPublicAttestation(profile: SmartProfile): boolean {
  try {
    // verifying public attestation
    // check attestation exist or not
    if (profile?.attestation && Object.keys(profile?.attestation)?.length > 0) {
      const isValidAttestation = await verifyOffchainAttestation(profile?.attestation);
      if (!isValidAttestation) {
        Logger.error('attestaion is not valid.');
        return isValidAttestation;
      }
    } else {
      // attestation not exist
      Logger.info('attestaion does not exist.');
      return true;
    }
    // verifying public attested data
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

export function verifyPrivateAttestation(profile: SmartProfile): boolean {
  try {
    // verifying private attestation
    const isValidCredAttestation = verifyCredAttestation(profile?.privateData?.attestedCred);
    const isValidPlatformIdAttestation = verifyPlatfomIdAttestation(profile?.privateData?.attestedPlatformIds);
    return isValidCredAttestation && isValidPlatformIdAttestation;
  } catch (error) {
    Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
    return false;
  }
}
