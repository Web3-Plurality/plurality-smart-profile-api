import express, { Request, response, Response } from "express";
import * as dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from "../data-source";
import Logger from "../lib/logger";
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import { ethers } from "ethers";
import jwt from 'jsonwebtoken';
import { isAuthenticated, isValid } from "../middlewares/authMiddleware";
import { calculateSocialScore, memoryStoreNonce, memoryStoreProfile } from "../utils/global";
import { generateNonce } from 'siwe';
import { app } from "..";
import { plainToInstance } from "class-transformer";
import { v4 as uuidv4 } from 'uuid';
import { SmartProfile } from "../entity/SmartProfile";
import axios from "axios";
import { RsmPoc } from "../entity/RSM";

export const rsmRouter = express.Router();
dotenv.config();
const rsmRepository = AppDataSource.getRepository(RsmPoc);

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
});

rsmRouter.post('/', async (req: Request, res: Response) => {
try {
    const {img, streamId} = req.body;
    // Upload an image
    let uploadResult;
    if (img) {
        uploadResult = await cloudinary.uploader
            .upload(
                img,
            )
            .catch((error) => {
                console.log(error);
            });
    }
    // Insert into RSM
    const newRsm = await rsmRepository.create({streamId: streamId, logo: uploadResult?.secure_url});
    await rsmRepository.save(newRsm);
    Logger.info(`RSM created: ${newRsm.id}`);
    return res.status(200).json({
        message: 'RSM created',
        data: newRsm
    });
} catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: "An error occurred while processing your request" });
}

})

rsmRouter.get('/', async (req: Request, res: Response) => {
try {
    const id: any = req?.query?.uuid
    const data = await rsmRepository.findOne({
        where:{
            id : id
        }
    })

    return res.status(200).json({data});
} catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: "An error occurred while processing your request" });
}
})


