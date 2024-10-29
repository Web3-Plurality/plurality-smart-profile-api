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


  export const FACEBOOK_FETCH_INTEREST_PROMPT = [
    {
      role: "system",
      content: "You are helpful asistant which extract insights from text and output it in JSON. The JSON object must use the schema: {Interests: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests and tags from these text and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string]}.
              Text:`
    }
  ]

  export const FACEBOOK_FETCH_INTEREST_FROM_NAMES_PROMPT = [
    {
      role: "system",
      content: "You are helpful asistant which extract insights from text and output it in JSON. The JSON object must use the schema: {Interests: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests, tags, type of music and sports user likes by looking the names of athletes, teams and musician, and make JSON of it.
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

  export const ROBLOX_FETCH_INTEREST_PROMPT = [
    {
      "role": "system",
      "content": "You are helpful asistant which extract insights from about of roblox user profile and output it in JSON. The JSON object must use the schema: {Interests: [string], IntroTags: [string]}."
    },
    {
      role: "user",
      content: `Fetch interests and tags from about of roblox user profile and make JSON of it.
              The JSON schema should contain the following Object: 
              Interests (also include other related topic and tags).
              Put everything in the Interests array.
              The second thing you have to do is Extract all introductory tags such as professions, roles, and notable titles from the following description and output them as a list of IntroTags.",
              if you did not find any thing still you have to follow schema out.
              The output JSON object must use the schema: {Interests: [string], IntroTags: [string]}.
              Text:`
    }
  ]