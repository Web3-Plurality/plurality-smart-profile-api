import jwt from 'jsonwebtoken';
import crypto from "crypto"
import { AppDataSource } from '../../../data-source';
import * as dotenv from 'dotenv';
import { ClientApp } from '../../user-service/entity/client-app';

dotenv.config();
const clientAppRepository = AppDataSource.getRepository(ClientApp);

// Middleware to authenticate client secret
export const isClientAuthenticated = async (req, res, next) => {
    const clientId = req.headers['x-client-id'];
    const clientSecret = req.headers['x-client-secret'];

    // clientId and secret should not be empty
    if (!clientId || !clientSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const client = await clientAppRepository.findOne({
        where: {
            id: clientId,
        },
    });
    if (!client) {
        return res.status(401).json({ error: 'Invalid Client ID' });
    }
    // verify secret
    const hashedSecret = crypto.createHash('sha256').update(clientSecret).digest('hex');
    if (hashedSecret !== client?.clientSecret) {
        return res.status(401).json({ error: 'Invalid Client Secret' });
    }

    req.client = client;
    next();
};


// Middleware to authenticate JWT
export const isUserAuthenticated = (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).send('Token is missing');
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send('Invalid token');
        }
        req.user = user;
        next();
    });
};