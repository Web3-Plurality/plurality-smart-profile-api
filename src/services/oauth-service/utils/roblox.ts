import puppeteer from 'puppeteer';
import { RobloxProfile } from '../entity/roblox';
// import moment from 'moment';

export const scrapRoblox = async (url: string) => {
  // Launch a browser instance
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Navigate to the Roblox profile page
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  // Extract the avatar image source
  const robloxInsights = await page.evaluate(() => {
    const imgElement = document.querySelector('.thumbnail-holder .thumbnail-2d-container img');
    const joinElement = document.querySelector(
      '#profile-statistics-container > div > div.section-content > ul > li:nth-child(1) > p.text-lead',
    );
    const placesVisitElement = document.querySelector(
      '#profile-statistics-container > div > div.section-content > ul > li:nth-child(2) > p.text-lead',
    );
    const friendElement = document.querySelector(
      '#profile-header-container > div > div > div > div.header-caption > div.header-details > ul.details-info > li:nth-child(1) > a > span',
    );
    const followerVisitElement = document.querySelector(
      '#profile-header-container > div > div > div > div.header-caption > div.header-details > ul.details-info > li:nth-child(2) > a > span',
    );
    const followingVisitElement = document.querySelector(
      '#profile-header-container > div > div > div > div.header-caption > div.header-details > ul.details-info > li:nth-child(3) > a > span',
    );

    return {
      avatar: imgElement ? imgElement.src : null,
      joinDate: joinElement ? joinElement.innerText : null,
      placesVisit: placesVisitElement ? placesVisitElement.innerText : null,
      friends: friendElement ? friendElement.innerText : null,
      followers: followerVisitElement ? followerVisitElement.innerText : null,
      following: followingVisitElement ? followingVisitElement.innerText : null,
    };
  });

  // Close the browser
  await browser.close();
  return robloxInsights;
};

export function calculateReputation(data: RobloxProfile): number {
  let reputationScore = 0;

  // Weighted factors based on importance
  const followersWeight = 0.3;
  const friendsWeight = 0.2;
  const followingWeight = 0.1;
  const placesVisitWeight = 0.1;
  const verifiedWeight = 0.2;
  const premiumWeight = 0.1;
  const createdAtWeight = 0.1;

  // Extract data from roblox profile
  const { placesVisit, friends, followers, following, idVerified, premium, joinDate } = data;

  // Calculate reputation score based on weighted factors
  reputationScore += followers * followersWeight;
  reputationScore += friends * friendsWeight;
  reputationScore += following * followingWeight;
  reputationScore += placesVisit * placesVisitWeight;

  // Consider verified status
  if (idVerified) {
    reputationScore *= verifiedWeight;
  }

  if (premium) {
    reputationScore *= premiumWeight;
  }

  // Calculate reputation based on account creation date
  // if (joinDate) {
  //     const accountAgeInYears = moment().diff(moment(joinDate), 'years');
  //     reputationScore += accountAgeInYears * createdAtWeight;
  // }

  return reputationScore;
}
