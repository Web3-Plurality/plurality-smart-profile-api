"use strict";
const Groq = require("groq-sdk");
const groq = new Groq({
    apiKey: "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"
});


export async function analyzeTweet(tweet : string) {
    const chatCompletion = await getGroqChatCompletion(tweet);
    // Print the completion returned by the LLM.
    // process.stdout.write(chatCompletion.choices[0]?.message?.content || "");
    const text = chatCompletion.choices[0]?.message?.content
    // text.replace("text","")
    console.log("text",text)


    // const jsonMatch = text.match(/```(.*?)```/s);
    // if (jsonMatch && jsonMatch[1]) {
      try {
        // Parse the JSON
        const jsonData = JSON.parse(text);
        // console.log('Extracted JSON:', jsonData);
        return jsonData
      } catch (error) {
        console.error('Error parsing JSON:', error.message);
      }
    // } 
    // else {
    //   console.log('No JSON block found.');
    // }

}
async function getGroqChatCompletion(tweet: string ) {
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
                "${tweet}"
                `
            } 
        ],
        model: "llama3-8b-8192",
        temperature: 0.5,
        // // max_tokens: 1024,
        // top_p: 1,
        stream: false,
        response_format: {
          type: "json_object"
        },
        stop: null
    });
}







