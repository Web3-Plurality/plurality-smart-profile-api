import express from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../../../data-source';
import { User } from '../entity/user';
import Logger from '../../../lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { ethers } from 'ethers';
import { isAuthenticated, isValidAddress } from '../../oauth-service/middlewares/oauth-middleware';
import { app } from '../../..';
import axios from 'axios';

export const capacityRouter = express.Router();
dotenv.config();
const userRepository = AppDataSource.getRepository(User);

/* eslint-disable */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});
/* eslint-enable */

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
    if (
      Number(litResponse?.data?.items[index].id) > Number(maxNft?.id) &&
      litResponse?.data?.items[index].token.address === '0x01205d94Fee4d9F59A4aB24bf80D11d4DdAf6Eed'
    ) {
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

capacityRouter.post('/', isAuthenticated, isValidAddress, async (req, res) => {
  // #swagger.tags = ['Users']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  try {
    const { address } = req.body;
    const id = req?.user?.id;
    const existingUser = await userRepository.findOne({
      where: {
        id: id,
      },
    });
    if (!existingUser?.address) {
      Logger.info(`The address against this email was not found`);

      const updatedUser = {
        address: address, // pkp address
      };

      await userRepository.update({ id: existingUser?.id }, updatedUser);
      Logger.info(`Putting Lit address on the current user id ${existingUser?.id}`);
    } else {
      Logger.info(`The address against this email is already found`);
      // if type pkp it means its coming from metamask method, if its metamask then give capacity to its pkp
      if (req?.body?.address !== existingUser?.address && req?.body?.method !== 'metamask') {
        Logger.error(`The address against this email is not correct`);
        return res.status(400).json({ error: 'The address against this email is not correct' });
      }
    }
    const capacityDelegationAuthSig = await capacityDelegation(address);
    Logger.info(`Capacity delegation auth sig generated for user id: ${id}`);
    return res.status(200).json({ success: true, capacityDelegationAuthSig });
  } catch (error) {
    Logger.error(`Fatal error due to unknown reason: ${JSON.stringify(error)}`);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});
