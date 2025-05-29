export function createPrompt(prompt: any, content: any) {
  if (typeof content === 'object') {
    const concatenatedCaptions = content.map((item: any) => item.caption).join(' ');
    prompt[1].content += '\n' + concatenatedCaptions;
    return prompt;
  } else {
    prompt[1].content += '\n' + content;
    return prompt;
  }
}

export const INSTA_FETCH_INTEREST_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from captions and output it in JSON. The JSON object must use the schema: {Interests: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests and tags from these captions and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string]}.
              Text:`,
  },
];

export const FACEBOOK_FETCH_INTEREST_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from text and output it in JSON. The JSON object must use the schema: {Interests: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests and tags from these text and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string]}.
              Text:`,
  },
];

export const FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from text and output it in JSON. The JSON object must use the schema: {Interests: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests, tags, type of music and sports user likes by looking the names of athletes, teams and musician, and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string]}.
              Text:`,
  },
];

export const TWITTER_FETCH_INTEREST_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from Tweet and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests and tags from this tweet and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`,
  },
];

export const TIKTOK_FETCH_INTEREST_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from Tweet and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests and tags from this tweet and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`,
  },
];

export const ROBLOX_FETCH_INTEREST_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful asistant which extract insights from about of roblox user profile and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}.',
  },
  {
    role: 'user',
    content: `Fetch interests and tags from about of roblox user profile and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`,
  },
];

export const USER_ONBOARDING_INSIGHTS_PROMPT = [
  {
    role: 'system',
    content:
      'You are helpful assistant which extract insights from user onboarding responses and output it in JSON. The JSON object must use the schema: {interests: string[], reputationTags: string[], badges: string[], collections: string[]}.',
  },
  {
    role: 'user',
    content: `Analyze these user onboarding responses and extract meaningful insights in JSON format.
              The JSON schema must contain the following fields:
              
              1. interests: An array of strings representing the user's interests, hobbies, and preferences
              2. reputationTags: An array of strings representing professional roles, identities, skills, and characteristics  
              3. badges: An array of strings representing achievements or notable attributes
              4. collections: An array of strings representing categories or groups that the user might belong to
              
              For simple question responses, extract key information about the user's personality and interests.
              For multiple choice selections, categorize them into the appropriate arrays.
              For category questions, add selected tags to both interests and their relevant arrays.
              
              If you don't find relevant data for any field, include an empty array.
              
              The output JSON object must strictly follow this schema: 
              {interests: string[], reputationTags: string[], badges: string[], collections: string[]}
              
              User onboarding responses:`,
  },
];

export const USER_SMART_PROFILE_PARAGRAPH_PROMPT = [
  {
    role: 'system',
    content:
      'You are a helpful assistant that creates positive, respectful, and uplifting descriptions of users based on their profile data. Always focus on positive attributes and strengths while maintaining honesty.',
  },
  {
    role: 'user',
    content: `Create a well-written paragraph (maximum 65 words and minimum 50 words) about the user in second person language based on given smart profile data.
              Focus only on your positive aspects and strengths.
              Use engaging, professional language that highlights your unique qualities.
              Avoid any negative, disrespectful, or potentially offensive content.
              Make the description honest but uplifting, emphasizing your interests, skills, and positive traits.
              If the data is limited, make reasonable positive assumptions.
               The output JSON object must strictly follow this schema: 
              {paragraph: string}

              Smart Profile Data:`,
  },
];
