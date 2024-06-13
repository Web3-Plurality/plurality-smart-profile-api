export const activeConnections = new Map();
export const TIKTOK_APP = "tiktok";
export const TWITTER_APP = "twitter";
export const SNAPCHAT_APP = "snapchat";
export const ROBLOX_APP = "roblox";

export const INSTAGRAM_APP = "instagram";
export const FACEBOOK_APP = "facebook";

// Groq Prompts
export const INSTA_FETCH_INTEREST_PROMPT = [
    {
      role: "system",
      content: "You are helpful asistant which extract insights from captions and output it in JSON. The JSON object must use the schema: {Interests: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests and tags from these captions and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string]}.
              Text:`
    }
  ]

  export const TWITTER_FETCH_INTEREST_PROMPT = [
    {
      "role": "system",
      "content": "You are helpful asistant which extract insights from Tweet and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests and tags from this tweet and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`
    }
  ]



  export const TIKTOK_FETCH_INTEREST_PROMPT = [
    {
      "role": "system",
      "content": "You are helpful asistant which extract insights from Tweet and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests and tags from this tweet and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`
    }
  ]