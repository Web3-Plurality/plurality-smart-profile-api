const { ethers } = require('ethers');
const dotenv  = require('dotenv');
dotenv.config();

// Replace with your own private key (DO NOT SHARE THIS KEY PUBLICLY)
const privateKey = process.env.PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey);

// The message you want to sign
const message = "0xc346e0b938c7f9c2d8f74aa6f65976b93d4a0fc4431c5a9d1eb0c36494a109c0";

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
