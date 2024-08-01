import axios from 'axios';
import { FacebookProfile } from '../entity/Facebook';
import Logger from '../lib/logger';
import { FACEBOOK_APP } from './global';

export function calculateReputation(data: FacebookProfile): number {
    let reputationScore: number = 0;

    // Weighted factors based on importance
    const friendsWeight: number = 0.3;
    const athletesCountWeight: number = 0.2;
    const favTeamCountWeight: number = 0.1;
    const likeCountWeight: number = 0.1;
    const musicCountWeight: number = 0.1;

    // Extract data from twitter profile
    const {
        friends_count,
        athletes_count,
        favTeam_count,
        likes_count,
        music_count,
    } = data;

    // Calculate reputation score based on weighted factors
    reputationScore += friends_count * friendsWeight;
    reputationScore += athletes_count * athletesCountWeight;
    reputationScore += favTeam_count * favTeamCountWeight;
    reputationScore += likes_count * likeCountWeight;
    reputationScore += music_count * musicCountWeight;


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

export function removeIdsFromObjects(data:any) {
    return data
        .map(obj => {
            const { id, ...rest } = obj;
            return rest;
        })
        .filter(obj => obj.description || obj.message || obj.name || obj.about || obj.category);
}

export function extractContent(data:any) {
    let content = '';
    for (let index = 0; index < data.length; index++) {
      if (data[index]?.message && data[index]?.description) {
        content += data[index]?.message 
        content += "\n"
        content += data[index]?.description;
        content += "\n"
      }
      else if (data[index]?.message) {
        content += data[index]?.message;
        content += "\n"
      }
      else if (data[index]?.description) {
        content += data[index]?.description;
        content += "\n"
      }
      else if (data[index]?.name) {
        content += data[index]?.name;
        content += "\n"
      }
      else if (data[index]?.about) {
        content += data[index]?.about;
        content += "\n"
      }
      
    }
  return content;

}

export const getPagingData = async (nextUrl:string) => {
    let data = [];
    let url  = nextUrl;
    for (let index = 0; index < 3; index++) {
        if (url) {
            
            try {
                const moreFeed = await axios.get(
                    url,
                    {
                        headers: {

                            "Content-Type": "application/json",
                        },
                        timeout: 20000,
                    }
                );

                data = data?.concat(moreFeed.data?.data)
                url = moreFeed.data?.paging?.next || "";
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    Logger.error(`${FACEBOOK_APP}: Request timeout error in fetching userinfo: ${error.message}`);
                } else {
                    Logger.error(`${FACEBOOK_APP}: An error occurred: ${error.message}`);
                }
                url = "";
            }
        }
    }

    return data;
}