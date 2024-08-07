// TODO: remane activeConnections to memoryStore to have generic naming for events and accesstoken
import jwt from 'jsonwebtoken';

export const activeConnections = new Map();
export const TIKTOK_APP = "tiktok";
export const TWITTER_APP = "twitter";
export const SNAPCHAT_APP = "snapchat";
export const ROBLOX_APP = "roblox";
export const INSTAGRAM_APP = "instagram";
export const FACEBOOK_APP = "facebook";
export const FORTNITE_APP = "fortnite";


export const INTERNAL_SERVER_ERROR = "Internal Server Error";
export const TIMEOUT_ERROR = 'Request timeout error in fetching userinfo';


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


export function generateJwt(token: any) {
  const payload = { accessToken: token };
  return jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' });
}