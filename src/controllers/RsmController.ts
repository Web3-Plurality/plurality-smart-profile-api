import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import { AppDataSource } from "../data-source";
import Logger from "../lib/logger";
import { v2 as cloudinary } from 'cloudinary';
import { RsmApp } from "../entity/RSM";
// import { isValidDomain } from "../middlewares/authMiddleware";

// rename rsm=clientApp 
export const rsmRouter = express.Router();
dotenv.config();
const rsmRepository = AppDataSource.getRepository(RsmApp);

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
});

rsmRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { img, streamId, links, domains , incentiveType} = req.body;
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
        const newRsm = await rsmRepository.create({ streamId: streamId, logo: uploadResult?.secure_url, incentiveType:incentiveType,links: JSON.stringify(links), domains: JSON.stringify(domains) });
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


rsmRouter.put('/:id', async (req: Request, res: Response) => {
    try {
        const { img, streamId, links, domains, incentiveType } = req.body;
        const id = req.params.id;
        
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
        // check customer exist already
        const data = await rsmRepository.findOne({
            where: {
                id: id
            }
        })
        // updated data
        const updataData = {
            streamId: streamId ? streamId : data?.streamId,
            logo: uploadResult?.secure_url ? uploadResult?.secure_url : data?.logo,
            links: links ? JSON.stringify(links) : data?.links,
            domains: domains ? JSON.stringify(domains) : data?.domains,
            incentiveType: incentiveType ? incentiveType : data?.incentiveType
        }
        await rsmRepository.update({ id: id }, updataData);
        Logger.info(`RSM updated: ${id}`);
        return res.status(200).json({
            message: 'RSM updated',
        });
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }

})

rsmRouter.get('/', async (req: Request, res: Response) => {
    try {

        const origin=req.headers['x-domain'];
        console.log(origin);
        const id: any = req?.query?.uuid
        const data = await rsmRepository.findOne({
            where: {
                id: id
            }
        })

        const domains = JSON.parse(data?.domains)
        
        if (domains?.includes(origin)) {
        Logger.info(`RSM fetched: ${id}`);
            return res.status(200).json({ data });
        }

        Logger.error(`Invalid domain: ${origin}`);
        return res.status(400).json({ error: "Invalid domain" });
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
})


