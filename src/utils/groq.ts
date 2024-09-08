"use strict";
import Groq from "groq-sdk";
import * as dotenv from 'dotenv';
import Logger from "../lib/logger";

dotenv.config();
const groq = new Groq({
  apiKey: process.env.GROQ_API
});
export async function analyze(prompt: any) {
  const chatCompletion = await getGroqChatCompletion(prompt);
  const text = chatCompletion.choices[0]?.message?.content;
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
async function getGroqChatCompletion(prompt: any) {
  return groq.chat.completions.create({
    messages: prompt,
    model: "llama3-8b-8192",
    temperature: 0.5,
    stream: false,
    response_format: {
      type: "json_object"
    },
    stop: null
  });
}