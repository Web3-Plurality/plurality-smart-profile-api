const { ethers } = require('ethers');
const dotenv  = require('dotenv');
dotenv.config();

// Replace with your own private key (DO NOT SHARE THIS KEY PUBLICLY)
const privateKey = process.env.PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey);

// The message you want to sign
const message = "0xf40b7651727a1e28da834e6ea129db21fe243eddd92fd5c8034904fcc8b2afc9";

// Sign the message
async function signMessage() {
    try {
        // Sign the message
        const signature = await wallet.signMessage(message);
        console.log('Message:', message);
        console.log('Signature:', signature);

        // Verify the signature
        const signerAddress = ethers.utils.verifyMessage(message, signature);
        console.log('Signer Address:', signerAddress);

    } catch (error) {
        console.error('Error signing message:', error);
    }
}

signMessage();
