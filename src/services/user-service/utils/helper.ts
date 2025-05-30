import { SmartProfile } from '@plurality-network/smart-profile-utils';

// Helper function to extract useful data for analysis
export function extractAnalysisData(smartProfile: SmartProfile): any {
  // Basic profile data that we know exists
  return {
    username: smartProfile.username,
    bio: smartProfile.bio,
    // connectedPlatforms: smartProfile.connectedPlatforms,
    // scores: smartProfile.scores,
    interests: [
      ...(smartProfile.privateData.claims.interests || []),
      ...(smartProfile.privateData.attestedCred.interests || []),
    ],
    reputationTags: [
      ...(smartProfile.privateData.claims.reputationTags || []),
      ...(smartProfile.privateData.attestedCred.reputationTags || []),
    ],
    badges: [
      ...(smartProfile.privateData.claims.badges || []),
      ...(smartProfile.privateData.attestedCred.badges || []),
    ],
    collections: [
      ...(smartProfile.privateData.claims.collections || []),
      ...(smartProfile.privateData.attestedCred.collections || []),
    ],
  };
}
