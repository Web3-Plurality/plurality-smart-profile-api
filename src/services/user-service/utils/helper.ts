import { plainToInstance } from 'class-transformer';
import { SmartProfile } from '../entity/smart-profile';
import { AttestCred, AttestedPlatformIds, ProfilePrivateData } from '../entity/profile-private-data';

export function normalizeSmartProfile(data: any) {
  const smartProfile = plainToInstance(SmartProfile, JSON.parse(JSON.stringify(data)));
  smartProfile.privateData = plainToInstance(ProfilePrivateData, smartProfile.privateData);
  smartProfile.privateData.attestedCred = plainToInstance(AttestCred, smartProfile.privateData.attestedCred);
  smartProfile.privateData.attestedPlatformIds = plainToInstance(
    AttestedPlatformIds,
    smartProfile.privateData.attestedPlatformIds,
  );
  return smartProfile;
}
