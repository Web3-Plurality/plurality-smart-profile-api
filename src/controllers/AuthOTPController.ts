import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';
import express, { Request, Response } from "express";
import { AuthMethodScope, AuthMethodType, ProviderType } from '@lit-protocol/constants';
import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { IRelayPKP } from '@lit-protocol/types';
import Logger from '../lib/logger';
import { AddUserClientMap, capacityDelegation, userRegisterViaEmail, userRegisterViaWallet } from './UserController';
import { memoryStoreNonce } from '../utils/global';
import { SiweMessage } from 'siwe';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export const authOTPRouter = express.Router();
const userRepository = AppDataSource.getRepository(User);

const stytchClient = new stytch.Client({
    project_id: "project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29",
    secret: "secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=",
});

const litAuthClient: LitAuthClient = new LitAuthClient({
    litRelayConfig: {
        relayApiKey: 'a018f989-fb99-4691-b107-bd50baa57bb6_hirasiddiqui95',
    },
});

const generatePkp = async (session_jwt: string) => {
    const provider = litAuthClient.initProvider(ProviderType.StytchEmailFactorOtp, {
        appId: "project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29",
    });
    if (!provider) {
        throw new Error('Provider is undefined');
    }
    const authMethod = {
        authMethodType: AuthMethodType.StytchEmailFactorOtp,
        accessToken: JSON.stringify(session_jwt),
    };
    const options = {
        permittedAuthMethodScopes: [[AuthMethodScope.SignAnything]],
    };

    // Mint PKP using the auth method
    const mintTx = await provider.mintPKPThroughRelayer(
        authMethod,
        options
    );
    Logger.info(`PKP minted: ${mintTx}`);
    const response = await provider.relay.pollRequestUntilTerminalState(mintTx);
    if (response.status !== 'Succeeded') {
        throw new Error('Minting failed');
    }
    const newPKP: IRelayPKP = {
        tokenId: response.pkpTokenId!,
        publicKey: response.pkpPublicKey!,
        ethAddress: response.pkpEthAddress!,
    };
    Logger.info("pkp generated successfully");
    return newPKP;
}

// Start the authentication flow
authOTPRouter.post("/otp/login", async function (req, res) {
    try {
        const templateId = "sign_in_to_plurality_network";
        const options: OTPsEmailLoginOrCreateRequest = {
            email: req.body.email,
            login_template_id: templateId,
            expiration_minutes: 2
        };
        const resp = await stytchClient.otps.email.loginOrCreate(options);
        Logger.info("OTP sent successfully");
        res.status(200).json({ success: true, message: 'OTP sent successfully', resp });
    } catch (err) {
        console.error(err);
        res.status(400).send('Authentication failed');
    }
});


// Complete the authentication flow which mints the session
// parameters : code, email_id, address, subscribe, clientId
authOTPRouter.post("/authenticate", async function (req, res) {
    try {

        let token = ""
        let addedUser = {};
        const uniqueSessionId = uuidv4();
        const params: OTPsAuthenticateRequest = { code: req.body.code, session_duration_minutes: 60, method_id: req.body.email_id };
        // stytch authenticate
        const resp = await stytchClient.otps.authenticate(params);
        Logger.info("stytch Authenticated successfully");
        // Check if the user with the given email already exists
        const email = resp?.user?.emails[0]?.email;
        const existingUser = await userRepository.findOne({
            where: {
                email: email,
            },
        });

        if (existingUser) {
            Logger.info(`This user already exists!`);
            token = jwt.sign({ id: existingUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
        }

        else {
            // If the user doesn't exist, insert a new row
            Logger.info(`The user with this email was not found`);
            let newUser = await userRepository.create({
                email: email, 
                subscribe: req?.body?.subscribe,

            });
            addedUser = await userRepository.save(newUser);
            Logger.info(`new user created successfully with id ${addedUser?.id}`);
            token = jwt.sign({ id: addedUser?.id, uniqueSessionId }, process.env.JWT_SECRET, { expiresIn: "1d" });
        }

        //if client id exist then add in user client map
        if (req?.body?.clientId) {
            await AddUserClientMap(existingUser?.id ? existingUser?.id : addedUser?.id, req?.body?.clientId);
        }
        else {
            Logger.error(`Client id not found`);
            throw new Error('Client id not found');
        }

        Logger.info(`jwt token generated for user id ${existingUser?.id ? existingUser?.id : addedUser?.id}`);
        return res.status(200).json({ success: true, token: token, user: addedUser });
    } catch (err) {
        console.error(err);
        res.status(401).send('Authentication failed');
    }
});