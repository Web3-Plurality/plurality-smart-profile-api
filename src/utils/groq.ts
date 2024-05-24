"use strict";
import Groq from "groq-sdk";
import * as dotenv from 'dotenv';
import Logger from "../lib/logger";

dotenv.config();
const groq = new Groq({
  apiKey: process.env.GROQ_API
});
export async function analyzeTweet(tweet: string) {
  const chatCompletion = await getGroqChatCompletion(tweet);
  const text = chatCompletion.choices[0]?.message?.content
  try {
    // Parse the JSON
    const jsonData = JSON.parse(text);
    return jsonData
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
    Logger.error('Error parsing JSON:', error.message);
    return {}
  }
}
async function getGroqChatCompletion(tweet: string) {
  return groq.chat.completions.create({
    messages: [
      {
        "role": "system",
        "content": "You are helpful asistant which extract insights from Tweet and output it in JSON. The JSON object must use the schema: {Interests: [string]}."
      },
      {
        role: "user",
        content: `Fetch interests and tags from this tweet and make JSON of it.
                The JSON schema should contain the following Object: 
                Interests (also include other related topic and tags).
                Put everything in the Interests array.
                if you did not find any thing still you have to follow schema out.
                The JSON object must use the schema: {Interests: [string]}.
                Text:
                ${tweet}
                `
      }
    ],
    model: "llama3-70b-8192",
    temperature: 0.5,
    stream: false,
    response_format: {
      type: "json_object"
    },
    stop: null
  });
}