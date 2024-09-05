import { v4 as uuidv4 } from 'uuid';

export const memoryStoreNonce = new Map();
export const memoryStoreToken = new Map();
export const memoryStoreProfile = new Map();
export const memoryStoreSSE = new Map();
export const TIKTOK_APP = "tiktok";
export const TWITTER_APP = "twitter";
export const SNAPCHAT_APP = "snapchat";
export const ROBLOX_APP = "roblox";
export const INSTAGRAM_APP = "instagram";
export const FACEBOOK_APP = "facebook";
export const FORTNITE_APP = "fortnite";
// scores Field
export const SOCIAL_SCORE = "social score";
export const REPUTATION_SCORE = "reputation score";



export const INTERNAL_SERVER_ERROR = "Internal Server Error";
export const TIMEOUT_ERROR = 'Request timeout error in fetching userinfo';


export function initSSE(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  const sseID = uuidv4();
  memoryStoreSSE.set(sseID, res);
  res.write(`data: {"message":"Connection established", "id":"${sseID}"}\n\n`);
}

export function parseQueryString(query: string) {
  let params: any = {};
  // Remove the leading question mark if present
  query = query.replace(/^\?/, '');
  // Split the query string on '&'
  const pairs = query.split('&');
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    params[key] = decodeURIComponent(value || '');
  });
  return params;
}

export function createPrompt(prompt: any, content: any) {
  if (typeof content === 'object') {
    const concatenatedCaptions = content.map(item => item.caption).join(' ');
    prompt[1].content += '\n' + concatenatedCaptions;
    return prompt;
  }
  else {
    prompt[1].content += '\n' + content;
    return prompt;
  }
}
export const  calculateSocialScore = (profilesInMemory: string[], reqConnectedProfiles: string[]): number  => {
  const score = 10
  let sumScore = 0
  const newProfiles = profilesInMemory.filter(profile => !reqConnectedProfiles.includes(profile))
  let count = reqConnectedProfiles?.length;
  for (let i = 0; i < newProfiles?.length; i++) {
    sumScore += (score * (count+1)) ** 2
    count+=1
  }
  return sumScore
}