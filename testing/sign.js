const { ethers } = require('ethers');
const dotenv  = require('dotenv');
dotenv.config();

// Replace with your own private key (DO NOT SHARE THIS KEY PUBLICLY)
const privateKey = process.env.PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey);

// The message you want to sign
const message = "0x9d12931474728ec43bd30179cb0da999852d6f6328bf23de967b223080b0a94e";

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
