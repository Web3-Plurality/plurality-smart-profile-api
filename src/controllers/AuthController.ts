import stytch, { OTPsAuthenticateRequest, OTPsEmailLoginOrCreateRequest } from 'stytch';
import express, { Request, Response } from "express";
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { AuthMethodScope, AuthMethodType, ProviderType } from '@lit-protocol/constants';
import { LitAuthClient, WebAuthnProvider } from '@lit-protocol/lit-auth-client';
import {IRelayPKP} from '@lit-protocol/types';
import { app } from "..";
import Logger from '../lib/logger';

export const authRouter = express.Router();

const stytchClient = new stytch.Client({
    project_id: "project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29",
    secret: "secret-test-FjWeo6SN_f6QcP-izJycjlBIIRQuVu53qBU=",
});

const litAuthClient: LitAuthClient = new LitAuthClient({
    litRelayConfig: {
        relayApiKey: 'a018f989-fb99-4691-b107-bd50baa57bb6_hirasiddiqui95',
    },
});


// Start the authentication flow
authRouter.post("/otp/login", async function (req, res) {
    try {


        const templateId = "sign_in_to_plurality_network";
        const options: OTPsEmailLoginOrCreateRequest = {
            email: req.body.email,
            login_template_id: templateId,
            expiration_minutes: 2
        };
        const resp = await stytchClient.otps.email.loginOrCreate(options);
        console.log(resp);
        res.status(200).end();
    } catch (err) {
        console.error(err);
        res.status(400).send('Authentication failed');
    }
});

// Complete the authentication flow which mints the session
authRouter.post("/otp/authenticate", async function (req, res) {
    try {
        const params: OTPsAuthenticateRequest = { code: req.body.code, session_duration_minutes: 60, method_id: req.body.email_id };
        const resp = await stytchClient.otps.authenticate(params);
        console.log(resp);

        //   generate PKP
        const provider = litAuthClient.initProvider(ProviderType.StytchEmailFactorOtp, {
            appId: "project-test-1b1bd75d-90d4-4c94-91b2-44f03f4a1d29",
        });

        if (!provider) {
            throw new Error('Provider is undefined');
        }

        const authMethod = {
            authMethodType: AuthMethodType.StytchEmailFactorOtp,
            accessToken: JSON.stringify(resp?.session_jwt),
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

        console.log(newPKP)
        // capacity Delegation


        //   res.cookie("stytch_session_jwt", resp.session_jwt);
        //   res.redirect('/dashboard');
        res.status(200).end();
    } catch (err) {
        console.error(err);
        res.status(401).send('Authentication failed');
    }
});
