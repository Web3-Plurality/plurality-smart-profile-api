import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import { body, validationResult, check } from 'express-validator';
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import Logger from "../lib/logger";

export const stytchRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);

// Custom validation function for email field
const validateEmail = (value: string) => {
    // Allow empty string or valid email format
    if (value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return true;
    }
    throw new Error('Invalid email address');
};

stytchRouter.post("/", [
            body('data.email').trim().custom(validateEmail),
            body('data.address').trim().escape(),
            body('data.subscribe').trim().escape()
        ], async (req: Request, res: Response) => {  
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            Logger.error(`Fatal error due to inproper request parameters to route POST /: ${JSON.stringify(errors)}`);
            return res.status(400).json({ errors: errors.array() });
        }
        const user = JSON.parse(JSON.stringify(req.body));
        Logger.info(`Received registration for user: ${JSON.stringify(user.data)}`);

        // User registered via email
        if(!!user.data.email) {
            Logger.info(`User register via email: ${user.data.email}`);
            // Check if the user with the given email already exists
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
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: ${user.data.subscribe} ...`);
                const newUser = await userRepository.create({
                    email: user.data.email,
                    address: user.data.address,
                    subscribe: user.data.subscribe,
                  });
                  await userRepository.save(newUser);
            }
        }
        // User registered via address and skipped email verification
        if(!user.data.email && !!user.data.address) {
            Logger.info(`User register via metamask address: ${user.data.address}`);
             // Check if the user with the given address already exists
            const existingUser = await userRepository.findOne({
            where: {
                address: user.data.address,
            },
            });
            if (existingUser) {
                Logger.info(`This user already exists!`);
            } else {
                // If the user doesn't exist, insert a new row
                Logger.info(`This is a new user! Creating an entry with email: ${user.data.email}, address: ${user.data.address}, subscribe: false ...`);
                const newUser = await userRepository.create({
                    email: user.data.email,
                    address: user.data.address,
                    subscribe: "false",
                  });
                await userRepository.save(newUser);
            }
        }
        Logger.info(`All done! Returning...`);
        res.json({ success: true });
    } catch (e) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(e)}`);
        res.status(500).json({ error: "An error occurred while processing your request" });;
    }
});

// GET endpoint to check if a user exists by address 
stytchRouter.get("/check-address", [
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
    
            // Extract the email from the sanitized query parameters  
            const { address } = req.query;
    
            // Query the database to check if the user exists and if the address is registered
            const existingUser = await userRepository.findOne({
                where: {
                    address: address as string,
                },
              }); 
    
            if (existingUser) {  
                Logger.info(`This user already exists! email: ${existingUser.email}, address: ${existingUser.address}, subscribe: ${existingUser.subscribe} `);      
                return res.json({ exists: true });
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


// // GET endpoint to check if a user exists by email 
// stytchRouter.get("/check-email", [
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