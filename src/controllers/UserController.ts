import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import { body, validationResult, check } from 'express-validator';
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import Logger from "../lib/logger";
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import { ethers } from "ethers";
import jwt from 'jsonwebtoken';
import { isAuthenticated, isValid } from "../middlewares/authMiddleware";
import { memoryStore } from "../utils/global";
import { generateNonce } from 'siwe';
import { app } from "..";

export const userRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);

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
                token = jwt.sign({ id: existingUser?.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: existingUser, token: token });
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: ${user.data.subscribe} ...`);
                const randomName = faker.person.lastName().toLocaleLowerCase();
                let newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: user.data.subscribe,
                    username: randomName
                });
                let addedUser = await userRepository.save(newUser);
                token = jwt.sign({ id: addedUser?.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: addedUser, token: token });
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
                token = jwt.sign({ id: existingUser?.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: existingUser, token: token });
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: false ...`);
                const randomName = faker.person.lastName().toLocaleLowerCase();
                const newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: "false",
                    username: randomName,
                });
                let addedUser = await userRepository.save(newUser);
                // remove address, only id is enough -> also at other places
                token = jwt.sign({ id: addedUser?.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
                Logger.info(`All done! Returning...`);
                return res.status(200).json({ success: true, user: addedUser, token: token });
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

        Logger.info(`user exist on id ${req?.user?.id}`);
        return res.status(200).json({ success: true, user: existingUser });


    } catch (e) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
})

userRouter.put("/", isAuthenticated, [
    body('data.id').optional().trim().isUUID(4).withMessage('Invalid UUID format'),
    body('data.username').optional().trim().isLength({ max: 50 }),
    body("bio").optional().trim().isLength({ max: 300 }),
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

        const user = JSON.parse(JSON.stringify(req.body.data));
        const { username, profileImg, bio } = user;
        const id = req?.user?.id;
        const existingUser = await userRepository.findOne({
            where: {
                id: id,
            },
        });

        if (existingUser) {
            Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
            // Upload an image
            let uploadResult;
            if (profileImg) {
                uploadResult = await cloudinary.uploader
                    .upload(
                        profileImg,
                    )
                    .catch((error) => {
                        console.log(error);
                    });
            }

            const updatedUser = {
                username: username ? username : existingUser?.username,
                profileImg: uploadResult?.secure_url ? uploadResult?.secure_url : existingUser?.profileImg,
                bio: bio ? bio : existingUser?.bio,
            }

            await userRepository.update({ id: id }, updatedUser);
            return res.status(200).json({ success: true, user: { email: user?.data?.email, ...updatedUser } });
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
        else{
            const nonce = generateNonce()
            memoryStore[walletAddress] = nonce;
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
        const { capacityDelegationAuthSig } =
            await app.locals.litNodeClient.createCapacityDelegationAuthSig({
                uses: '100',
                dAppOwnerWallet: DAPP_OWNER_WALLET,
                capacityTokenId: process.env.PUBLIC_CAPACITY_TOKEN_ID,
                delegateeAddresses: [existingUser?.address],
            });
        return res.status(200).json({ success: true, capacityDelegationAuthSig });

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
