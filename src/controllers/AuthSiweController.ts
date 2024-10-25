
import express, { Request, Response } from "express";
import Logger from '../lib/logger';
import { userRegisterViaWallet } from './UserController';
import { memoryStoreNonce } from '../utils/global';
import { SiweMessage } from 'siwe';



export const authSiweRouter = express.Router();


authSiweRouter.post("/", async function (req, res) {
    try {
        const siweObj = req.headers['x-siwe'] ? JSON.parse(req.headers['x-siwe']) : '';
        const siweToken = siweObj?.siwe;
        const message = decodeURIComponent(siweObj?.message);
        const nonce = memoryStoreNonce.get(req?.body?.address);
        const siweMessage = new SiweMessage(message);
        const siweResponse = await siweMessage.verify({ signature: siweToken })
        // check nonce
        if (!nonce) {
            Logger.error(`Invalid nonce`);
            return res.status(400).send('Invalid nonce');
        }
        // delete nonce with the address
        delete memoryStoreNonce[req?.body?.address];
        // check signature
        if (!siweResponse.success) {
            Logger.error(`Invalid siwe token`);
            return res.status(400).send('Invalid siwe token');
        }
        if (siweMessage?.address?.toLowerCase() !== req?.body?.address?.toLowerCase()) {
            Logger.error(`Invalid siwe token`);
            return res.status(400).send('Invalid siwe token');
        }
        // create jwt token
        Logger.info(`user authenticated successfully by address ${req?.body?.address}`)
        const token = await userRegisterViaWallet(req?.body?.email, req?.body?.address, req?.body?.clientId)
        return res.status(200).json({ success: true, token: token, email:req?.body?.email, address:req?.body?.address });
    } catch (err) {
        Logger.error(`Error occurred: ${err}`);
        res.status(401).send('Authentication failed');
    }
});
