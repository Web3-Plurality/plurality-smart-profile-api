import { EAS, Offchain, OffchainAttestationVersion, OffchainConfig, PrivateData, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import Logger from "../../../lib/logger";
import { SmartProfile } from "../entity/smart-profile";
import { attestationCredSchema, attestationPlatformIdSchema, privateOffchainAttestations, publicOffchainAttestation, setAttestation } from "./eas-helper";


// attest profile
export async function attestProfile(id: string, profile: SmartProfile, userAddress: string) {
    //Public attestation
    const publicAttestation = await publicOffchainAttestation(profile, userAddress);
    profile.attestation = setAttestation(publicAttestation);
    Logger.info(`public Data of profile attested successfully for user id: ${id}`);
    //private data attestation
    const credSchema = attestationCredSchema(profile, false);
    if (credSchema?.length > 0) {
      const credAttestation = await privateOffchainAttestations(credSchema, userAddress);
      profile.privateData.attestedCred.attestation = setAttestation(credAttestation);
      Logger.info(`private Cred Data of profile attested successfully for user id: ${id}`);
    }
  
    const platformIdSchema = attestationPlatformIdSchema(profile, false);
    if (platformIdSchema?.length > 0) {
      const platformIdsAttestation = await privateOffchainAttestations(platformIdSchema, userAddress);
      profile.privateData.attestedPlatformIds.attestation = setAttestation(platformIdsAttestation);
      Logger.info(`private platformIds Data of profile attested successfully for user id: ${id}`);
    }
    return profile;
  }


  // verifying attestation
  export function verifyOffcahinAttestation(attestation: any) {
    try {
      const EASContractAddress = process.env.EAS_CONTRACT_ADDRESS || '0x'; // Sepolia v0.26
      // Initialize the sdk with the address of the EAS Schema contract address
      const eas = new EAS(EASContractAddress);
      const EAS_CONFIG: OffchainConfig = {
        address: attestation.domain.verifyingContract,
        version: attestation.domain.version,
        chainId: BigInt(attestation.domain.chainId),
      };
      const signerAddress = process.env.PUBLIC_DAPP_OWNER_WALLET_ADDRESS || "";
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
      const credSchema = attestationCredSchema(profile, true);
      const platfomSchema = attestationPlatformIdSchema(profile, true);
      let validCredsData = false;
      let validPlatformsData = false;
      //validating crerds data
      if (credSchema?.length > 0) {
        const privateData = new PrivateData(credSchema);
        const fullTree = privateData.getFullTree();
        const schemaEncoder = new SchemaEncoder('bytes32 privateData');
        const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
        validCredsData = profile.privateData.attestedCred.attestation.message.data === encodedData;
      } else {
        //if no data then dont need to validate it
        validCredsData = true;
      }
      //validating platform data
      if (platfomSchema?.length > 0) {
        const privateData = new PrivateData(platfomSchema);
        const fullTree = privateData.getFullTree();
        const schemaEncoder = new SchemaEncoder('bytes32 privateData');
        const encodedData = schemaEncoder.encodeData([{ name: 'privateData', value: fullTree.root, type: 'bytes32' }]);
        validPlatformsData = profile.privateData.attestedPlatformIds.attestation.message.data === encodedData;
      } else {
        //if no data then dont need to validate it
        validPlatformsData = true;
      }
  
      return validPlatformsData && validCredsData;
    } catch (error) {
      Logger.error(`error occur while verifying offchain attestation ${JSON.stringify(error)}`);
      return false;
    }
  }