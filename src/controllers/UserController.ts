import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import Logger from "../lib/logger";
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import { ethers } from "ethers";
import jwt from 'jsonwebtoken';
import { isAuthenticated, isValid } from "../middlewares/authMiddleware";
import { calculateSocialScore, memoryStoreNonce, memoryStoreProfile, SOCIAL_SCORE } from "../utils/global";
import { generateNonce } from 'siwe';
import { app } from "..";
import { plainToInstance } from "class-transformer";
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile } from "../entity/smartProfile";
import  {SmartProfileMap}  from "../entity/SmartProfileMap";
import axios from "axios";



export const userRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);
const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);


// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
});

// Custom validation function for email field
const validateEmail = (value: string) => {
    // Allow empty string or valid email format
    if (value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return true;
    }
    throw new Error('Invalid email address');
};

userRouter.post("/", [
    body('data.email').trim().custom(validateEmail),
    body('data.address').trim().escape(),
    body('data.subscribe').toBoolean()
], isValid, async (req: Request, res: Response) => {
    try {
        let token;
        const uniqueSessionId = uuidv4();
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            Logger.error(`Fatal error due to improper request parameters to route POST /: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }
        const user = JSON.parse(JSON.stringify(req.body));
        Logger.info(`Received registration for user: ${JSON.stringify(user.data)}`);
        // User registered via email
        if (!!user.data.email) {
            Logger.info(`User register via email: ${user.data.email}`);
            // Check if the user with the given email already exists
            const existingUser = await userRepository.findOne({
                where: {
                    email: user.data.email,
                },
            });
            if (existingUser) {
                Logger.info(`This user already exists!`);
                token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                const { username, bio, profileImg, ...remainingProfile } = existingUser;
                return res.status(200).json({ success: true, user: remainingProfile, token: token });
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: ${user.data.subscribe} ...`);
                // const randomName = faker.person.lastName().toLocaleLowerCase();
                let newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: user.data.subscribe,
                    // username: randomName
                });
                let addedUser = await userRepository.save(newUser);
                const { username, bio, profileImg, ...remainingProfile } = addedUser;
                token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: remainingProfile, token: token });
            }
        }
        // User registered via address and skipped email verification
        else if (!user.data.email && !!user.data.address) {
            Logger.info(`User register via metamask address: ${user.data.address}`);
            // Check if the user with the given address already exists
            const existingUser = await userRepository.findOne({
                where: {
                    address: user.data.address,
                },
            });
            if (existingUser) {
                Logger.info(`This user already exists!`);
                const { username, bio, profileImg, ...remainingProfile } = existingUser;
                token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: remainingProfile, token: token });
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: false ...`);
                // const randomName = faker.person.lastName().toLocaleLowerCase();
                const newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: "false",
                    // username: randomName,
                });
                let addedUser = await userRepository.save(newUser);
                // remove address, only id is enough -> also at other places
                token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                const { username, bio, profileImg, ...remainingProfile } = addedUser;
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: remainingProfile, token: token });
            }
        }
    } catch (e) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        res.status(500).json({ error: "An error occurred while processing your request" });
    }
});

// We authentication check here
// GET endpoint to check if a user exists by address 
// userRouter.get("/check-address", [
//     check('address').trim().escape(), // Validate the address
// ], async (req: Request, res: Response) => {
//     try {
//         Logger.info(`Receiving check address request: ${JSON.stringify(req.query)}`);
//         // Check for validation errors
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             Logger.error(`Fatal error due to improper request parameters to route GET /check-address: ${JSON.stringify(errors)}`);
//             return res.status(400).json({ errors: errors.array() });
//         }
//         const { address } = req.query;

//         // Query the database to check if the user exists and if the address is registered
//         const existingUser = await userRepository.findOne({
//             where: {
//                 address: address as string,
//             },
//         });

//         if (existingUser) {
//             Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
//             let user = JSON.parse(JSON.stringify({ id: existingUser.id, username: existingUser.username, profileImg: existingUser.profileImg }));
//             return res.json({ exists: true, user: user });
//         } else {
//             // User does not exist
//             Logger.info(`This user does not exist!`);
//             return res.json({ exists: false });
//         }
//     } catch (e) {
//         // If an error occurs during the database query, return an error response
//         Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
//         return res.status(500).json({ error: "An error occurred while processing your request" });
//     }
// });

userRouter.get("/", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const existingUser = await userRepository.findOne({
            where: {
                id: req?.user?.id,
            },
        });
        if (!existingUser) {
            Logger.error(`user not exist on id ${req?.user?.id}`);
            return res.status(404).json({ success: false, error: `user doest not exist` });
        }
        const { username, bio, profileImg, ...remainingProfile } = existingUser;
        Logger.info(`user exist on id ${req?.user?.id}`);
        return res.status(200).json({ success: true, user: remainingProfile });

    } catch (e) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
})
// body => { data: { username: string, bio: string, profileImg: string }, smartProfile: SmartProfile }
userRouter.put("/", isAuthenticated, [
    body('data.username').optional().trim().isLength({ max: 50 }),
    body('data.bio').optional().trim().isLength({ max: 300 }),
    body('smartProfile')
    .optional() // Only validate if it exists
    .custom((value) => {
        // If the value is empty or undefined, allow it to pass
        if (!value) {
            return true;
            }
      // Ensure the object is an instance of SmartProfile
      if (!(plainToInstance(SmartProfile,value) instanceof SmartProfile)) {
        throw new Error('smartProfile must be an instance of SmartProfile');
      }
      return true;
    }),
    body('data.profileImg').optional()
        .trim()
        .custom((value) => {
            // If the value is empty or undefined, allow it to pass
            if (!value) {
                return true;
            }
            const base64Pattern = /^data:image\/(jpeg|png|gif|bmp|tiff|webp);base64,/;
            if (!base64Pattern.test(value)) {
                throw new Error('Profile image must be a base64 encoded image');
            }
            return true;
        })
        
    ], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            Logger.error(`Fatal error due to improper request parameters to route GET /: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }
        const profileTypeStreamId=process.env.PROFILE_TYPE_STREAM_ID;
        const user_update_req_data = JSON.parse(JSON.stringify(req.body.data));
        const smartProfile = plainToInstance(SmartProfile, JSON.parse(JSON.stringify(req?.body?.smartProfile)));
        //const { username, profileImg, bio} = user;
        const id = req?.user?.id;
        const existingUser = await userRepository.findOne({
            where: {
                id: id,
            },
        });

        if (existingUser) {
            Logger.info(`This user exists in database! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
            // Upload an image
            let uploadResult;
            if (user_update_req_data.profileImg) {
                uploadResult = await cloudinary.uploader
                    .upload(
                        user_update_req_data.profileImg,
                    )
                    .catch((error) => {
                        console.log(error);
                    });
            }

            const updatedUser = {
                username: user_update_req_data.username || smartProfile?.username,
                avatar: uploadResult?.secure_url || smartProfile?.avatar,
                bio: user_update_req_data.bio ||  smartProfile?.bio,
            }
            await smartProfileMapRepository.update({ userId: req?.user?.id, profileTypeStreamId: profileTypeStreamId }, updatedUser);

            if (smartProfile) {
                smartProfile.username = user_update_req_data.username || smartProfile?.username;
                smartProfile.avatar = uploadResult?.secure_url || smartProfile?.avatar;
                smartProfile.bio = user_update_req_data.bio || smartProfile?.bio;
                Logger.info(`Smart profile updated locally for user id: ${id}`);
                return res.status(200).json({ success: true, smartProfile: smartProfile });
            }
            Logger.error(`user profile not found on body`);
            return res.status(400).json({ success: false, error: "user profile not found in the body" });

        } else {
            // User does not exist
            Logger.info(`This user does not exist!`);
            return res.status(404).json({ exists: false });
        }
    }
    catch (e) {
        // If an error occurs during the database query, return an error response
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
});

//generate random string to take user signature
userRouter.get('/nonce/:wallet', (req, res) => {
    try {
        const walletAddress = req?.params?.wallet;
        if (!ethers.utils.isAddress(walletAddress)) {
            Logger.error(`Fatal error due to invalid wallet address: ${walletAddress}`);
            return res.status(400).json({ error: "Invalid wallet address" });
        }
        else {
            const nonce = generateNonce()
            memoryStoreNonce.set(walletAddress, nonce);
            Logger.info(`Nonce generated for address ${walletAddress}: ${nonce}`);
            return res.status(200).json({ message: "success", nonce });
        }
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
});


userRouter.get('/capacity', isAuthenticated, async (req, res) => {
    try {
        const id = req?.user?.id;
        const existingUser = await userRepository.findOne({
            where: {
                id: id,
            },
        });
        // owner wallet which has the capacity NFT
        const DAPP_OWNER_WALLET = new ethers.Wallet(process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const litResponse = await axios.get(`https://yellowstone-explorer.litprotocol.com/api/v2/addresses/${DAPP_OWNER_WALLET.address}/nft?type=ERC-721%2CERC-404%2CERC-1155`)
        let maxNft = { id: 0 }
        for (let index = 0; index < litResponse?.data?.items.length; index++) {
            if (Number(litResponse?.data?.items[index].id) > Number(maxNft?.id)) {
                maxNft = litResponse?.data?.items[index];
                if (currentTimestamp < Number(maxNft?.metadata?.attributes[0]?.value)) {
                    break;
                }
            }
        }

        if (currentTimestamp > Number(maxNft?.metadata?.attributes[0]?.value)) {
            Logger.error(`Last NFT expired at: ${maxNft?.metadata?.attributes[0]?.value}`);
            return res.status(500).json({ error: "Capacity NFT expired" });
        }

        const { capacityDelegationAuthSig } =
            await app.locals.litNodeClient.createCapacityDelegationAuthSig({
                uses: '100',
                dAppOwnerWallet: DAPP_OWNER_WALLET,
                capacityTokenId: Number(maxNft?.id),
                delegateeAddresses: [existingUser?.address],
            });
        Logger.info(`Capacity delegation auth sig generated for user id: ${id}`);
        return res.status(200).json({ success: true, capacityDelegationAuthSig });

    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
});
// body => { smartProfile: SmartProfile }
// header => { Authorization: Bearer token }
userRouter.post('/smart-profile', isAuthenticated, async (req, res) => {
    try {
        const profileTypeStreamId=process.env.PROFILE_TYPE_STREAM_ID;
        const id = req?.user?.uniqueSessionId;
        let memorySmartProfile = memoryStoreProfile.get(id);
        // profile exchange workflow
        if (memorySmartProfile && req?.body?.smartProfile && profileTypeStreamId) 
        {
            const smartProfile = plainToInstance(SmartProfile, req?.body?.smartProfile);
            // check if the current platform is already connected
            if(smartProfile.connected_platforms.includes(memorySmartProfile?.connected_profiles[0]?.platform_name))
            {
                Logger.error(`The profile is already connected: ${memorySmartProfile.connected_profiles[0]?.platform_name}`);
                memoryStoreProfile.delete(id);
                return res.status(400).json({ error: "Bad request" });
            }
            const socialScore = calculateSocialScore(memorySmartProfile?.connected_profiles, smartProfile?.connected_profiles);
            memorySmartProfile.updateScoreValue('social_score', socialScore);
            smartProfile.aggregateProfile(memorySmartProfile);
            smartProfile.connected_platforms=smartProfile.connected_profiles.map((profile)=>{return profile.platform_name});
            memoryStoreProfile.delete(id);
            const updatedSmartProfileMap = {
                connectedProfiles: smartProfile?.connected_profiles,
                scores: smartProfile?.scores
            }

            await smartProfileMapRepository.update(
                { userId: req?.user?.id, profileTypeStreamId: profileTypeStreamId },
                updatedSmartProfileMap
            );
            Logger.info(`Smart profile found for user id: ${id}`);
            return res.status(200).json({ success: true, smartProfile: smartProfile });
        } 
        // new profile creation
        else if (!memorySmartProfile && !req?.body?.smartProfile && profileTypeStreamId) 
        {
            Logger.info(`no profile connected on id: ${id}`);

             // check if the profile map between user id and profile type exists 
             const profileMapping = await smartProfileMapRepository.findOne({
                where: {
                    userId: req?.user?.id,
                    profileTypeStreamId: profileTypeStreamId
                },
            });
            if(!profileMapping)
            {
                 // this is the new user
                const existingUser = await userRepository.findOne({
                    where: {
                        id: req?.user?.id,
                    },
                });
                const newProfile = new SmartProfile({
                    username: existingUser?.username ? existingUser?.username :  faker.person.lastName().toLocaleLowerCase(), 
                    avatar: existingUser?.profileImg ? existingUser?.profileImg :  "https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png" ,
                    bio: existingUser?.bio ? existingUser?.bio :  ''
                });
                newProfile.updateScoreValue('social_score', existingUser?.username? 1000 : Number(process.env.DEFAULT_SOCIAL_SCORE))

                const newSmartProfileMap = await smartProfileMapRepository.create({username: newProfile?.username, avatar: newProfile?.avatar, bio: newProfile?.bio, connectedProfiles: [], scores: newProfile?.scores, profileTypeStreamId: profileTypeStreamId, userId: req?.user?.id});
                console.log(newSmartProfileMap);
                await smartProfileMapRepository.save(newSmartProfileMap);
                Logger.info(`Smart profile created for user id: ${id}`);
                return res.status(200).json({ success: true, smartProfile: newProfile });
            }
            else
            {
                // if profile map exists in database we return the smart profile based on the map
                console.log('profile map found in database');
                const oldProfile = new SmartProfile({
                    username: profileMapping?.username ? profileMapping?.username :  faker.person.lastName().toLocaleLowerCase(), 
                    avatar: profileMapping?.avatar ? profileMapping?.avatar :  "https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png" ,
                    scores: profileMapping?.scores,
                    connected_profiles: profileMapping?.connectedProfiles,
                    connected_platforms: profileMapping?.connectedProfiles?.map((profile)=>{return profile.platform_name})
                });
                console.log(oldProfile);
                Logger.info(`Smart profile returned from profile map table: ${id}, This is not normal workflow`);
                return res.status(200).json({ success: true, smartProfile: oldProfile });
            }          
        }
        else 
        {
            Logger.error(`Either smart profile is not in the request body or no individual profile is connected for user: ${id}`);
            return res.status(400).json({ error: "Bad request" });
        }
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
});


// // GET endpoint to check if a user exists by email
// userRouter.get("/check-email", [
//     check('email').trim().custom(validateEmail), // Validate the email
// ], async (req: Request, res: Response) => {
//     try {
//         Logger.info(`Receiving check email request: ${JSON.stringify(req.query)}`);
//         // Check for validation errors
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             Logger.error(`Fatal error due to improper request parameters to route GET /check-email: ${JSON.stringify(errors)}`);
//             return res.status(400).json({ errors: errors.array() });
//         }

//         // Extract the email from the sanitized query parameters
//         const { email } = req.query;

//         // Query the database to check if the user exists and if the address is registered
//         const existingUser = await userRepository.findOne({
//             where: {
//                 email: email as string,
//             },
//           });

//         if (existingUser) {
//             Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
//             return res.json({ exists: true });
//         } else {
//             // User does not exist
//             Logger.info(`This user does not exist!`);
//             return res.json({ exists: false });
//         }
//     } catch (e) {
//         // If an error occurs during the database query, return an error response
//         Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
//         return res.status(500).json({ error: "An error occurred while processing your request" });
//     }
// });


// GET endpoint to get user object
// userRouter.get("/", [
//     check('email').trim().custom(validateEmail), // Validate the email
// ], async (req: Request, res: Response) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             Logger.error(`Fatal error due to improper request parameters to route GET /: ${JSON.stringify(errors)}`);
//             return res.status(400).json({ errors: errors.array() });
//         }

//         // Extract the email from the sanitized query parameters
//         const { email } = req.query;
//         const { address } = req.query;

//         // Query the database to check if the user exists and if the address is registered
//         const existingUser = email ? await userRepository.findOne({
//             where: {
//                 email: email as string,
//             },
//         }) : await userRepository.findOne({
//             where: {
//                 address: address as string,
//             },
//         });

//         if (existingUser) {
//             Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
//             return res.status(200).json({ exists: true, user: existingUser });
//         } else {
//             // User does not exist
//             Logger.info(`This user does not exist!`);
//             return res.status(404).json({ exists: false });
//         }
//     }
//     catch (e) {
//         // If an error occurs during the database query, return an error response
//         Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
//         return res.status(500).json({ error: "An error occurred while processing your request" });
//     }
// });
