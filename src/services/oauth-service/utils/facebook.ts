import axios from 'axios';
import { FacebookProfile } from '../entity/facebook';
import Logger from '../../../lib/logger';
import { FACEBOOK_APP } from '../utils/constants';

export function calculateReputation(data: FacebookProfile): number {
  let reputationScore = 0;

  // Weighted factors based on importance
  const friendsWeight = 0.3;
  const athletesCountWeight = 0.2;
  const favTeamCountWeight = 0.1;
  const likeCountWeight = 0.1;
  const musicCountWeight = 0.1;

  // Extract data from facebook profile
  const { friendsCount, athletesCount, favTeamCount, likesCount, musicCount } = data;

  // Calculate reputation score based on weighted factors
  reputationScore += friendsCount * friendsWeight;
  reputationScore += athletesCount * athletesCountWeight;
  reputationScore += favTeamCount * favTeamCountWeight;
  reputationScore += likesCount * likeCountWeight;
  reputationScore += musicCount * musicCountWeight;

  // Consider verified status
  // if (verified) {
  //     reputationScore *= verifiedWeight;
  // }

  // Analyze description for keywords
  // You can customize this part based on specific criteria or keywords
  // if (description.toLowerCase().includes("expert")) {
  //     reputationScore *= 1.1;
  // }
  // if (description.toLowerCase().includes("author")) {
  //     reputationScore *= 1.2;
  // }
  // if (description.toLowerCase().includes("influencer")) {
  //     reputationScore *= 1.3;
  // }

  // Calculate reputation based on account creation date
  // if (createdAt) {
  //     const accountAgeInYears = moment().diff(moment(createdAt), 'years');
  //     reputationScore += accountAgeInYears * createdAtWeight;
  // }

  return reputationScore;
}
// remove ids from objects
export function sanitizeObject(data: any) {
  return data
    .map((obj) => {
      const { id, ...rest } = obj;
      return rest;
    })
    .filter((obj) => obj.description || obj.message || obj.name || obj.about || obj.category);
}

export function extractContent(data: any) {
  let content = '';
  for (let index = 0; index < data.length; index++) {
    if (data[index]?.message && data[index]?.description) {
      content += data[index]?.message;
      content += '\n';
      content += data[index]?.description;
      content += '\n';
    } else if (data[index]?.message) {
      content += data[index]?.message;
      content += '\n';
    } else if (data[index]?.description) {
      content += data[index]?.description;
      content += '\n';
    } else if (data[index]?.name) {
      content += data[index]?.name;
      content += '\n';
    } else if (data[index]?.about) {
      content += data[index]?.about;
      content += '\n';
    }
  }
  return content;
}

export const getPagingData = async (nextUrl: string) => {
  let data = [];
  let url = nextUrl;
  for (let index = 0; index < 3; index++) {
    if (url) {
      try {
        const moreFeed = await axios.get(url, {
          headers: {
            'Content-Type': 'application/json', // eslint-disable-line
          },
          timeout: 20000,
        });

        data = data?.concat(moreFeed.data?.data);
        url = moreFeed.data?.paging?.next || '';
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
        } else {
          Logger.error(`${FACEBOOK_APP}: An error occurred: ${error.message}`);
        }
        url = '';
      }
    }
  }

  return data;
};
