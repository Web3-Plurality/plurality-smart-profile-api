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
import { isAuthenticated } from "../middlewares/authMiddleware";
import stytch  from "stytch";

export const userRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);

const client = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_SECRET,
    // env: stytch.envs.test,
  });

let challenges = {}; // Store challenge messages temporarily

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
    body('data.subscribe').trim().escape(),
    body('data.signature').trim().escape(),
    body('data.stytch_token').trim().escape()

], async (req: Request, res: Response) => {
    try {
        let dbUser;
        let token;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            Logger.error(`Fatal error due to inproper request parameters to route POST /: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }
        const user = JSON.parse(JSON.stringify(req.body));
        Logger.info(`Received registration for user: ${JSON.stringify(user.data)}`);

        // User registered via email
        if (!!user.data.email) {
            Logger.info(`User register via email: ${user.data.email}`);
            // Check if the user with the given email already exists
            const stytchSession = await client.sessions.authenticateJwt({
                session_jwt: user?.data?.stytch_token,
              })
            if (!stytchSession?.session?.user_id) {
                Logger.error(`Invalid stytch token`);
                return res.status(401).json({ errors: "Invalid stytch token" });
            }
            const existingUser = await userRepository.findOne({
                where: {
                    email: user.data.email,
                },
            });
            if (existingUser) {
                // If the user exists, update this entry
                // We need to check if the address is recorded or not
                const userAddress = user.data.address ? user.data.address : existingUser.address
                Logger.info(`This user already exists! Updating the user info with email: ${user.data.email}, address: ${userAddress}, subscribe: ${user.data.subscribe} ...`);
                await userRepository.update({ email: user.data.email }, { address: userAddress, subscribe: user.data.subscribe });
                dbUser = JSON.parse(JSON.stringify({ id: existingUser.id, username: existingUser.username, profileImg: existingUser.profileImg  }));
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: ${user.data.subscribe} ...`);
                const randomName = faker.person.lastName().toLocaleLowerCase();
                let newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address: user.data.address === "" ? null : user.data.address,
                    subscribe: user.data.subscribe,
                    username: randomName,
                });
                let addedUser = await userRepository.save(newUser);
                dbUser = JSON.parse(JSON.stringify({ id: addedUser.id, username: addedUser.username, profileImg: addedUser.profileImg  }));
            }
             token = jwt.sign({ email:user.data.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
        }
        // User registered via address and skipped email verification
        if (!user.data.email && !!user.data.address) {
            Logger.info(`User register via metamask address: ${user.data.address}`);

            const challenge = challenges[user.data.address];
            if (!challenge) {
                Logger.error(`Invalid challenge`);
                return res.status(400).send('Invalid challenge');
            }
        
            // Verify signature
            const signerAddress = ethers.utils.verifyMessage(challenge, user?.data?.signature);
        
            if (signerAddress.toLowerCase() !== user.data.address.toLowerCase()) {
                Logger.error(`Invalid signature`);
                return res.status(400).send('Invalid signature');
            }
                // Signature is valid, issue JWT token
                delete challenges[user.data.address]; // Optionally delete the used challenge
               
            // Check if the user with the given address already exists
            const existingUser = await userRepository.findOne({
                where: {
                    address: user.data.address,
                },
            });
            if (existingUser) {
                dbUser = JSON.parse(JSON.stringify({ id: existingUser.id, username: existingUser.username, profileImg: existingUser.profileImg  }));
                Logger.info(`This user already exists!`);
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: false ...`);
                const randomName = faker.person.lastName().toLocaleLowerCase();
                const newUser = await userRepository.create({
                    email: user.data.email === "" ? null : user.data.email,
                    address:  user.data.address === "" ? null : user.data.address,
                    subscribe: "false",
                    username: randomName,
                });
                let addedUser = await userRepository.save(newUser);
                dbUser = JSON.parse(JSON.stringify({ id: addedUser.id, username: addedUser.username, profileImg: addedUser.profileImg  }));
            }
             token = jwt.sign({ address:user.data.address,id:dbUser?.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        }

        Logger.info(`All done! Returning...`);
        res.json({ success: true, user: dbUser, token:token });
    } catch (e) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        res.status(500).json({ error: "An error occurred while processing your request" });;
    }
});
// We authentication check here
// GET endpoint to check if a user exists by address 
userRouter.get("/check-address", [
    check('address').trim().escape(), // Validate the address
], async (req: Request, res: Response) => {
    try {
        Logger.info(`Receiving check address request: ${JSON.stringify(req.query)}`);
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            Logger.error(`Fatal error due to inproper request parameters to route GET /check-address: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }
        const { address } = req.query;

        // Query the database to check if the user exists and if the address is registered
        const existingUser = await userRepository.findOne({
            where: {
                address: address as string,
            },
        });

        if (existingUser) {
            Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);
            let user=JSON.parse(JSON.stringify({ id: existingUser.id, username: existingUser.username, profileImg: existingUser.profileImg  }));
            return res.json({ exists: true, user: user });
        } else {
            // User does not exist
            Logger.info(`This user does not exist!`);
            return res.json({ exists: false });
        }
    } catch (e) {
        // If an error occurs during the database query, return an error response
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
});
// We authentication check here
// GET endpoint to get user object
userRouter.put("/", isAuthenticated, [
    body('data.id').optional().trim().isUUID(4).withMessage('Invalid UUID format'),
    body('data.username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    body("bio").optional().trim().isLength({ max: 300 }),
    body('data.profileImg').optional()
    .trim()
    .custom((value) => {
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
            Logger.error(`Fatal error due to inproper request parameters to route GET /: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }

        const user = JSON.parse(JSON.stringify(req.body.data));

        const { username, profileImg, bio } = user;
        const id = req?.user?.id;
        // agr sirf id se user access kren ge to me apne ap ko authenticate kraa kr kisi or ki cheezen change kr skta hun
        const existingUser = await userRepository.findOne({
            where: {
                id: id,
            },
        });

        if (existingUser) {
            Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);

            // Upload an image
            let uploadResult;
            if(profileImg) {
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
            return res.status(200).json({ success: true , user: { email: user?.data?.email, ...updatedUser}});
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
userRouter.get('/challenge', (req, res) => {
    const walletAddress = req.query.address;
    const challenge = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    challenges[walletAddress] = challenge;
    return res.status(200).json({ message:"success", challenge});
   
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
//             Logger.error(`Fatal error due to inproper request parameters to route GET /check-email: ${JSON.stringify(errors)}`);
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
//             Logger.error(`Fatal error due to inproper request parameters to route GET /: ${JSON.stringify(errors)}`);
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
