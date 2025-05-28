import express, { Request, Response } from 'express';
import { isAuthenticated, isClientAppAuthenticated, isValidUserJwt } from '../middlewares/auth-middleware';
import Logger from '../../../lib/logger';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import { UserSession } from '../../auth-service/entity/user-session';
import { plainToInstance } from 'class-transformer';
import { normalizeSmartProfile, SmartProfile } from '@plurality-network/smart-profile-utils';
import { body } from 'express-validator';
import { createPrompt, USER_SMART_PROFILE_PARAGRAPH_PROMPT } from '../../oauth-service/utils/ai-prompts';
import { analyze } from '../../oauth-service/utils/groq';

const userRepository = AppDataSource.getRepository(User);
const userSessionRepository = AppDataSource.getRepository(UserSession);
export const userRouter = express.Router();

// endpoint for the client to validate the user session by providing clientAppId, clientAppSercret and user token
userRouter.post('/validate', isValidUserJwt, isClientAppAuthenticated, async (req: Request, res: Response) => {
  // #swagger.tags = ['Users']
  /* #swagger.security = [{
        "basicAuth": []
    }] */
  try {
    const clientApp = req?.clientApp;
    const userClientAppMap = await userSessionRepository.findOne({
      where: {
        id: req?.user?.uniqueSessionId,
      },
    });
    if (userClientAppMap?.clientAppId !== clientApp?.id) {
      return res.status(401).json({ error: 'user does not belong to the given client' });
    }

    const user = await userRepository?.findOne({
      where: {
        id: req?.user?.id,
      },
    });

    res.status(200).json({
      success: true,
      user: { id: user?.id, email: user?.email, authAddress: user?.authAddress, proxyAddress: user?.pkpAddress },
    });
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Helper function to extract useful data for analysis
function extractAnalysisData(smartProfile: SmartProfile): any {
  // Basic profile data that we know exists
  return {
    username: smartProfile.username,
    bio: smartProfile.bio,
    // connectedPlatforms: smartProfile.connectedPlatforms,
    // scores: smartProfile.scores,
    interests: [
      ...(smartProfile.privateData.claims.interests || []),
      ...(smartProfile.privateData.attestedCred.interests || []),
    ],
    reputationTags: [
      ...(smartProfile.privateData.claims.reputationTags || []),
      ...(smartProfile.privateData.attestedCred.reputationTags || []),
    ],
    badges: [
      ...(smartProfile.privateData.claims.badges || []),
      ...(smartProfile.privateData.attestedCred.badges || []),
    ],
    collections: [
      ...(smartProfile.privateData.claims.collections || []),
      ...(smartProfile.privateData.attestedCred.collections || []),
    ],
  };
}

userRouter.post(
  '/analyse',
  isAuthenticated,
  [
    body('smartProfile').custom((value) => {
      // Ensure the object is an instance of SmartProfile
      if (!(plainToInstance(SmartProfile, JSON.parse(JSON.stringify(value))) instanceof SmartProfile)) {
        throw new Error('smartProfile must be an instance of SmartProfile');
      }
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    const { smartProfile: reqSmartProfile } = req.body;

    if (Object.keys(reqSmartProfile).length === 0) {
      return res.status(400).json({ error: 'smartProfile is required' });
    }
    Logger.info(`Analyzing smart profile`);
    const smartProfile = normalizeSmartProfile(plainToInstance(SmartProfile, reqSmartProfile));

    try {
      // Extract only relevant fields from smart profile for analysis
      const relevantData = extractAnalysisData(smartProfile);

      // Prepare the prompt with only relevant smart profile data
      const prompt = createPrompt(USER_SMART_PROFILE_PARAGRAPH_PROMPT, JSON.stringify(relevantData));
      console.log(prompt);
      // Analyze the smart profile with Groq
      const result = await analyze(prompt);

      return res.status(200).json({
        success: true,
        paragraph: result?.paragraph || 'Could not generate a paragraph at this time.',
      });
    } catch (error) {
      Logger.error('Error analyzing smart profile:', error);
      return res.status(500).json({ error: 'Failed to analyze smart profile' });
    }
  },
);
