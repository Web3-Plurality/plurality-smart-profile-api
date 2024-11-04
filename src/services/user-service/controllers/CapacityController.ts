import express from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/User';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { ethers } from 'ethers';
import { isAuthenticated, isValidAddress } from '../../oauth-service/middlewares/oauthMiddleware';
import { app } from '../../..';
import axios from 'axios';

export const capacityRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});

// capacity delegation
export const capacityDelegation = async (walletAddress) => {
  // owner wallet which has the capacity NFT
  const DAPP_OWNER_WALLET = new ethers.Wallet(process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const litResponse = await axios.get(
    `https://yellowstone-explorer.litprotocol.com/api/v2/addresses/${DAPP_OWNER_WALLET.address}/nft?type=ERC-721%2CERC-404%2CERC-1155`,
  );
  let maxNft = { id: 0 };
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
    throw new Error('Capacity NFT expired');
  }

  const { capacityDelegationAuthSig } = await app.locals.litNodeClient.createCapacityDelegationAuthSig({
    uses: '100',
    dAppOwnerWallet: DAPP_OWNER_WALLET,
    capacityTokenId: maxNft?.id.toString(),
    delegateeAddresses: [walletAddress],
  });

  return capacityDelegationAuthSig;
};

//body => address
capacityRouter.post('/', isAuthenticated, isValidAddress, async (req, res) => {
  try {
    const id = req?.user?.id;
    const existingUser = await userRepository.findOne({
      where: {
        id: id,
      },
    });
    if (!existingUser?.address) {
      Logger.info(`The address against this email was not found`);

      const updatedUser = {
        address: req?.body.address, // pkp address
      };

      await userRepository.update({ id: existingUser?.id }, updatedUser);
      Logger.info(`Putting Lit address on the current user id ${existingUser?.id}`);
    } else {
      Logger.info(`The address against this email is already found`);
      if (req?.body?.address !== existingUser?.address) {
        Logger.error(`The address against this email is not correct`);
        return res.status(400).json({ error: 'The address against this email is not correct' });
      }
    }
    const capacityDelegationAuthSig = await capacityDelegation(req?.body.address);
    Logger.info(`Capacity delegation auth sig generated for user id: ${id}`);
    return res.status(200).json({ success: true, capacityDelegationAuthSig });
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
