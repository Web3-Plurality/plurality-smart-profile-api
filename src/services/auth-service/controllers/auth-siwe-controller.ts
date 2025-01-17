import express, { Request, Response } from 'express';
import Logger from '../../../lib/logger';
import { memoryStoreNonce } from '../../../utils/global';
import { generateNonce, SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { LoginType, User } from '../../user-service/entity/user';
import { AppDataSource } from '../../../data-source';
import { AddUserClientMap } from '../utils/user';
import * as dotenv from 'dotenv';

dotenv.config();

export const authSiweRouter = express.Router();
const userRepository = AppDataSource.getRepository(User);

const userRegisterViaWallet = async (address: string, clientId: string) => {
  let addedUser: any = {};
  // Check if the user with the given address already exists
  const existingUser = await userRepository.findOne({
    where: {
      authAddress: address,
    },
  });
  if (existingUser) {
    Logger.info(`This user already exists!`);
  } else {
    // If the user doesn't exist, insert a new row
    const newUser = await userRepository.create({
      authAddress: address,
      subscribe: false,
      loginType: LoginType.metamask,
    });
    Logger.info(`new user created with address: ${address}`);
    addedUser = await userRepository.save(newUser);
  }
  //if client id exist then add in user client map
  if (clientId) {
    const uniqueSessionId = await AddUserClientMap(existingUser?.id ? existingUser?.id : addedUser?.id, clientId);
    const token = jwt.sign(
      { id: existingUser?.id ? existingUser?.id : addedUser?.id, uniqueSessionId },
      process.env.JWT_SECRET || "",
      { expiresIn: '1d' },
    );
    Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);
    return { token, user: existingUser?.id ? existingUser : addedUser };
  } else {
    Logger.error(`Client id not found`);
    throw new Error('Client id not found');
  }
};

//generate random string to take user signature
authSiweRouter.post('/login', (req: Request, res: Response) => {
  // #swagger.tags = ['Auth']
  try {
    const walletAddress: string = req.body.address;
    if (!ethers.isAddress(walletAddress)) {
      Logger.error(`Fatal error due to invalid wallet address: ${walletAddress}`);
      return res.status(400).json({ error: 'Invalid wallet address' });
    } else {
      const nonce = generateNonce();
      memoryStoreNonce.set(walletAddress, nonce);
      Logger.info(`Nonce generated for address ${walletAddress}: ${nonce}`);
      return res.status(200).json({ message: 'success', nonce });
    }
  } catch (error: any) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
// address, clientId, subscribe
authSiweRouter.post('/authenticate', async function (req: Request, res: Response) {
  // #swagger.tags = ['Auth']
  try {
    const { address, clientId }: { address: string; clientId: string } = req.body;
    const siweObj = req.headers['x-siwe'] ? JSON.parse(Array.isArray(req.headers['x-siwe'])?req.headers['x-siwe'][0]: req.headers['x-siwe']) : '';
    const siweToken = siweObj?.siwe;
    const message = decodeURIComponent(siweObj?.message);
    const nonce = memoryStoreNonce.get(address);
    const siweMessage = new SiweMessage(message);
    const siweResponse = await siweMessage.verify({ signature: siweToken });
    // check nonce
    if (!nonce) {
      Logger.error(`Invalid nonce`);
      return res.status(400).send('Invalid nonce');
    }
    // delete nonce with the address
    memoryStoreNonce.delete(address);
    // check signature
    if (!siweResponse.success) {
      Logger.error(`Invalid siwe token`);
      return res.status(400).send('Invalid siwe token');
    }
    if (siweMessage?.address?.toLowerCase() !== address?.toLowerCase()) {
      Logger.error(`Invalid siwe token`);
      return res.status(400).send('Invalid siwe token');
    }
    // create jwt token
    Logger.info(`user authenticated successfully by address ${address}`);
    const { token, user } = await userRegisterViaWallet(address, clientId);
    return res.status(200).json({ success: true, token, user });
  } catch (err) {
    Logger.error(`Error occurred: ${err}`);
    res.status(401).send('Authentication failed');
  }
});
