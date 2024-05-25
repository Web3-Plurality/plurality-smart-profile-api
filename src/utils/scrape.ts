import puppeteer from 'puppeteer';
import { analyzeTweet } from './groq';
import Logger from '../lib/logger';

export async function scrape(url: string) {
  try {
    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--window-size=1280,800']
    });
    const page = await browser.newPage();
    // Set the viewport size
    await page.setViewport({ width: 1280, height: 800 });
    // Navigate to the actual website where you want to extract data
    await page.goto(url);
    await page.waitForSelector('article[data-testid="tweet"]');
    const tweetObj = await page.evaluate(() => {
      const tweetElement = document.querySelector('div[data-testid="tweetText"]');
      const element = document.querySelector('article[data-testid="tweet"]');
      if (element) {
        const data = element?.innerText.split("\n")
        const obj: any = {}
        let i = 0
        while (i < data.length) {
          if (data[i].trim() === "Bookmarks" || data[i].trim() === "Likes" || data[i].trim() === "Quotes" || data[i].trim() === "Reposts") {
            obj[data[i].trim()] = data[i - 1].trim();
            i += 1
          }
          else if (data[i].trim() === "Views") {
            obj[data[i].trim()] = data[i - 1].trim();
            obj["date"] = data[i - 3].trim();

            i += 1
          }
          else if (data[i].trim()[0] === "@") {

            obj["username"] = data[i].trim();
            i += 1
          }
          else {
            i += 1
          }
        }
        return {
          ...obj,
          "tweetText": tweetElement ? tweetElement?.innerText : null,
        }
      }
      else {
        return {"interests":[],"introTags":[]}
      }
    });

    await browser.close();

    const semanticObj = tweetObj?.tweetText ? await analyzeTweet(tweetObj?.tweetText) : {}

    return { ...tweetObj, "interests": semanticObj?.Interests ? semanticObj?.Interests : [], "introTags": semanticObj?.IntroTags ? semanticObj?.IntroTags : [] }

  } catch (error) {
    console.log(error)
    Logger.error(`Error during scraping:, ${error.message}`);
    return {"interests":[],"introTags":[]}
  }

}