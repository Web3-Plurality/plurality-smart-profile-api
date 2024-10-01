import express, { Request, Response } from "express";
import * as dotenv from 'dotenv';
import { AppDataSource } from "../data-source";
import Logger from "../lib/logger";
import { v2 as cloudinary } from 'cloudinary';
import { RsmPoc } from "../entity/RSM";
import { isValidDomain } from "../middlewares/authMiddleware";

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
        const { img, streamId, links, domains } = req.body;
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
        const newRsm = await rsmRepository.create({ streamId: streamId, logo: uploadResult?.secure_url, links: JSON.stringify(links), domains: JSON.stringify(domains) });
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
        const { img, streamId, links, domains } = req.body;
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
            domains: domains ? JSON.stringify(domains) : data?.domains
        }
        const updatedRsm = await rsmRepository.update({ id: id }, updataData);
        Logger.info(`RSM updated: ${updatedRsm.id}`);
        return res.status(200).json({
            message: 'RSM updated',
            data: updatedRsm
        });
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }

})



rsmRouter.get('/', async (req: Request, res: Response) => {
    try {
        const host = req.get('host');
        const origin = req.get('origin');
        console.log(host);
        console.log(origin);
        const id: any = req?.query?.uuid
        const data = await rsmRepository.findOne({
            where: {
                id: id
            }
        })

        const domains = JSON.parse(data?.domains)
        if (domains?.includes(origin) || domains?.includes(host)) {
            return res.status(200).json({ data });
        }

        Logger.error(`Invalid domain: ${origin}`);
        return res.status(400).json({ error: "Invalid domain" });
    } catch (error) {
        Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "An error occurred while processing your request" });
    }
})


