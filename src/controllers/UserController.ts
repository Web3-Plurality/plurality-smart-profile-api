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
import { SmartProfile } from "../entity/SmartProfile";
import { SmartProfileMap } from "../entity/SmartProfileMap";
import axios from "axios";
import { EarlyUser } from "../entity/EarlyUser";
import { UserClientMap } from "../entity/UserClientMap";
import { ClientApp } from "../entity/ClientApp";



export const userRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);
const smartProfileMapRepository = AppDataSource.getRepository(SmartProfileMap);
const earlyUserRepository = AppDataSource.getRepository(EarlyUser);
const clientAppRepository = AppDataSource.getRepository(ClientApp);
const userClientMapRepository = AppDataSource.getRepository(UserClientMap);



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

const AddUserClientMap = async (userId: string, clientId: string) => {
    try {
        const existingClient = await clientAppRepository.findOne({ where: { id: clientId } })
        if (existingClient) {
            const newUserClientMap = await userClientMapRepository.create({ userId: userId, clientId: clientId });
            await userClientMapRepository.save(newUserClientMap);
            Logger.info(`UserClientMap created: ${newUserClientMap.id}`);
        }
    }
    catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    }
}


// add client id in request 
// create post middleware
userRouter.post("/", [
    body('data.email').trim().custom(validateEmail),
    body('data.address').trim().escape(),
    body('data.subscribe').toBoolean(),
    body('data.clientId').trim().escape(),
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
        if (!!user.data.email && !!user.data.address) {
            Logger.info(`User register via email: ${user.data.email}`);
            // Check if the user with the given email already exists
            const existingUser = await userRepository.findOne({
                where: {
                    email: user.data.email,
                },
            });
            if (existingUser) {
                if (!existingUser?.address) {
                    Logger.info(`The address against this email was not found`);
                    const updatedUser = {
                        address: user.data.address, // pkp address
                        subscribe: user.data.subscribe,
                    }
                    await userRepository.update({ id: existingUser?.id }, updatedUser)
                    Logger.info(`Putting Lit address on the current user id ${existingUser?.id}`);
                    token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                    //if client id exist then add in user client map
                    if (user.data.clientId) {
                        await AddUserClientMap(existingUser?.id, user.data.clientId);
                    }
                    Logger.info(`All done! Returning...`);
                    return res.status(200).json({ success: true, token: token });
                }
                else if (existingUser?.address === user.data.address) {
                    Logger.info(`This user already exists!`);
                    token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                    //if client id exist then add in user client map
                    if (user.data.clientId) {
                        await AddUserClientMap(existingUser?.id, user.data.clientId);
                    }
                    Logger.info(`All done! Returning...`);
                    return res.status(200).json({ success: true, token: token });
                }
                else {
                    Logger.error(`The address against this email is not correct`);
                    return res.status(400).json({ error: "Bad request" });
                }

            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: ${user.data.subscribe} ...`);
                let newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: user.data.subscribe,

                });
                let addedUser = await userRepository.save(newUser);
                token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                //if client id exist then add in user client map
                if (user.data.clientId) {
                    await AddUserClientMap(addedUser?.id, user.data.clientId);
                }
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, token: token });
            }
        }
        // User registered via Metamask
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
                token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                //if client id exist then add in user client map
                if (user.data.clientId) {
                    await AddUserClientMap(existingUser?.id, user.data.clientId);
                }
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, token: token });
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: false ...`);
                const newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: false,
                });
                let addedUser = await userRepository.save(newUser);
                
                token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
                //if client id exist then add in user client map
                if (user.data.clientId) {
                    await AddUserClientMap(addedUser?.id, user.data.clientId);
                }
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, token: token });
            }

        }
        else {
            Logger.error(`The request params (address or email) combination is not correct`);
            return res.status(400).json({ error: "Bad request" });
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

// userRouter.get("/", isAuthenticated, async (req: Request, res: Response) => {
//     try {
//         const existingUser = await userRepository.findOne({
//             where: {
//                 id: req?.user?.id,
//             },
//         });
//         if (!existingUser) {
//             Logger.error(`user not exist on id ${req?.user?.id}`);
//             return res.status(404).json({ success: false, error: `user doest not exist` });
//         }
//         const { username, bio, profileImg, ...remainingProfile } = existingUser;
//         Logger.info(`user exist on id ${req?.user?.id}`);
//         return res.status(200).json({ success: true, user: remainingProfile });

//     } catch (e) {
//         Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
//         return res.status(500).json({ error: "An error occurred while processing your request" });
//     }
// })
// body => { data: { username: string, bio: string, profileImg: string }, smartProfile: SmartProfile }
// stream id in request/header
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
            if (!(plainToInstance(SmartProfile, value) instanceof SmartProfile)) {
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
        // load this dynamically from headers
        const profileTypeStreamId = req.headers['x-stream-id'];
        if (!profileTypeStreamId) {
            Logger.error(`Fatal error due to missing profile type stream id`);
            return res.status(400).json({ errors: "profile type stream id is missing" });            
        }
        const user_update_req_data = JSON.parse(JSON.stringify(req.body.data));
        const smartProfile = plainToInstance(SmartProfile, JSON.parse(JSON.stringify(req?.body?.smartProfile)));
        const id = req?.user?.id;
        // get from smartProfileMap
        const existingUser = await smartProfileMapRepository.findOne({
            where: {
                userId: id,
                profileTypeStreamId: profileTypeStreamId
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
            // now update the original smart profile with the updated values and return   
            if (smartProfile) {
                smartProfile.username = user_update_req_data.username || smartProfile?.username;
                smartProfile.avatar = uploadResult?.secure_url || smartProfile?.avatar;
                smartProfile.bio = user_update_req_data.bio || smartProfile?.bio;

                // remove this below
                const updatedUser = {
                    username: user_update_req_data.username || smartProfile?.username,
                    avatar: uploadResult?.secure_url || smartProfile?.avatar,
                    bio: user_update_req_data.bio || smartProfile?.bio,
                }

                // Update the existing profile
                await smartProfileMapRepository.update({ id: existingUser.id }, updatedUser);
                Logger.info(`Smart profile updated locally for user id: ${id}`);
                return res.status(200).json({ success: true, smartProfile: smartProfile });
            }
            else {

                Logger.error(`user profile not found on body`);
                return res.status(400).json({ success: false, error: "user profile not found in the body" });
            }

        } else {
            // User with this profile does not exist
            Logger.info(`This user with this profile does not exist!`);
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
        if (!ethers.isAddress(walletAddress)) {
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
                capacityTokenId: maxNft?.id.toString(),
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
// stream id in body or header
userRouter.post('/smart-profile', isAuthenticated, async (req, res) => {
    try {
        // load dynamically from header
        const profileTypeStreamId = req.headers['x-stream-id'];
        const id = req?.user?.uniqueSessionId;
        let memorySmartProfile = memoryStoreProfile.get(id);
        // profile exchange workflow - profiles are present in both request and memory
        if (memorySmartProfile && req?.body?.smartProfile && profileTypeStreamId) {
            Logger.info(`Profile exchange workflow`);
            const smartProfile = plainToInstance(SmartProfile, req?.body?.smartProfile);

            // this is not the first time this profile is being created - make sure the profile mapping exists in our database
            const profileMapping = await smartProfileMapRepository.findOne({
                where: {
                    userId: req?.user?.id,
                    profileTypeStreamId: profileTypeStreamId
                },
            });
            if (!profileMapping) {
                // there must be something wrong if this mapping does not exist, this is a corner case but we create the mapping
                Logger.info(`The older version of this profile was not found in profile mapping table, This is not normal`);
                const newSmartProfileMap = await smartProfileMapRepository.create({ username: smartProfile?.username, avatar: smartProfile?.avatar, bio: smartProfile?.bio, connectedProfiles: smartProfile?.connected_profiles, scores: smartProfile?.scores, profileTypeStreamId: profileTypeStreamId, userId: req?.user?.id });
                console.log(newSmartProfileMap);
                await smartProfileMapRepository.save(newSmartProfileMap);
                Logger.info(`Smart profile created for user id: ${req?.user?.id}`);
            }
            else {
                // profile mapping found, everything is okay
                Logger.info(`Smart profile found for user id: ${req?.user?.id}`);
            }

            // check if the current platform is already connected
            if (smartProfile.connected_platforms.includes(memorySmartProfile?.connected_profiles[0]?.platform_name)) {
                // If this platform is already connected there is no need to add this one to profile
                Logger.info(`The profile is already connected: ${memorySmartProfile.connected_profiles[0]?.platform_name}`);
                memoryStoreProfile.delete(id);
                return res.status(400).json({ error: "Bad request" });
            }
            // Calculate the social score based on the input profiles data
            const socialScore = calculateSocialScore(memorySmartProfile?.connected_profiles, smartProfile?.connected_profiles);
            memorySmartProfile.updateScoreValue('social_score', socialScore);

            // Now we aggregate profiles
            smartProfile.aggregateProfile(memorySmartProfile);
            smartProfile.connected_platforms = smartProfile.connected_profiles.map((profile) => { return profile.platform_name });
            memoryStoreProfile.delete(id);

            const updatedSmartProfileMap = {
                connectedProfiles: smartProfile?.connected_profiles,
                scores: smartProfile?.scores
            }

            // Update the profiles mapping table with updated profile
            await smartProfileMapRepository.update(
                { userId: req?.user?.id, profileTypeStreamId: profileTypeStreamId },
                updatedSmartProfileMap
            );
            Logger.info(`Smart profile updated for user id: ${req?.user?.id}`);
            return res.status(200).json({ success: true, smartProfile: smartProfile });
        }
        // new profile creation
        else if (!memorySmartProfile && !req?.body?.smartProfile && profileTypeStreamId) {
            Logger.info(`New profile creation workflow`);
            // check if the profile map between user id and profile type exists 
            const profileMapping = await smartProfileMapRepository.findOne({
                where: {
                    userId: req?.user?.id,
                    profileTypeStreamId: profileTypeStreamId
                },
            });
            if (!profileMapping) {
                // this is the new user
                const earlyUser = await earlyUserRepository.findOne({
                    where: {
                        id: req?.user?.id,
                    },
                });
                const newProfile = new SmartProfile({
                    username: earlyUser?.username ? earlyUser?.username : faker.person.lastName().toLocaleLowerCase(),
                    avatar: earlyUser?.profileImg ? earlyUser?.profileImg : "https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png",
                    bio: ''
                });
                newProfile.updateScoreValue('social_score', earlyUser?.username ? 1000 : Number(process.env.DEFAULT_SOCIAL_SCORE))

                const newSmartProfileMap = await smartProfileMapRepository.create({ username: newProfile?.username, avatar: newProfile?.avatar, bio: newProfile?.bio, connectedProfiles: [], scores: newProfile?.scores, profileTypeStreamId: profileTypeStreamId, userId: req?.user?.id });
                console.log(newSmartProfileMap);
                await smartProfileMapRepository.save(newSmartProfileMap);
                Logger.info(`New smart profile created for user id: ${id}`);
                return res.status(200).json({ success: true, smartProfile: newProfile });
            }
            else {
                // if profile map exists in database we return the smart profile based on the map
                Logger.info(`Profile map already found in database`);
                const oldProfile = new SmartProfile({
                    username: profileMapping?.username ? profileMapping?.username : faker.person.lastName().toLocaleLowerCase(),
                    avatar: profileMapping?.avatar ? profileMapping?.avatar : "https://res.cloudinary.com/dblrsf3fe/image/upload/v1721919290/wkaejhi7ocnwhfl42vb8.png",
                    //scores: profileMapping?.scores,
                    connected_profiles: profileMapping?.connectedProfiles,
                    connected_platforms: profileMapping?.connectedProfiles?.map((profile) => { return profile.platform_name })
                });
                // need to set this explicitly 
                oldProfile.scores = profileMapping?.scores;
                console.log(oldProfile);
                Logger.info(`Old version of smart profile returned from profile map: ${id}, This is not normal workflow`);
                return res.status(200).json({ success: true, smartProfile: oldProfile });
            }
        }
        else {
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
