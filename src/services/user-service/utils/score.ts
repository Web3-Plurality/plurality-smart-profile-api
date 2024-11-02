export const calculateSocialScore = (profilesInMemory: any[], reqConnectedProfiles: any[]): number => {
  const score = 10;
  let sumScore = 0;

  const reqConnectedPlatforms = reqConnectedProfiles?.map((profile) => {
    return profile?.platform_name;
  });
  const newProfiles = profilesInMemory.filter((profile) => !reqConnectedPlatforms.includes(profile));

  let count = reqConnectedPlatforms?.length;
  for (let i = 0; i < newProfiles?.length; i++) {
    sumScore += (score * (count + 1)) ** 2;
    count += 1;
  }
  return sumScore;
};
