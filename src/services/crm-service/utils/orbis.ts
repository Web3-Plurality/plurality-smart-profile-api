// import { CeramicDocument, IEVMProvider, OrbisConnectResult, OrbisDB } from "@useorbis/db-sdk";
// import { OrbisEVMAuth, OrbisKeyDidAuth } from "@useorbis/db-sdk/auth";
// import { ethers } from "ethers";
// // require = require("esm")(module);
// // const dbSdk = require("@useorbis/db-sdk");

// const orbisdb = new OrbisDB({
//     ceramic: {
//         gateway: process.env.CERAMIC_URL || ""
//     },
//     nodes: [
//         {
//             gateway: process.env.ORBIS_NODE_URL || "",
//             env: process.env.ORBIS_ENV
//         }
//     ]
// })



// export async function connectOrbisDidPkh() {
//     // Orbis Authenticator, will use Ethereum or Solana auth
//     const provider: any  = new ethers.Wallet(process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || "");
    

//     const auth = new OrbisEVMAuth(provider);

//     // Authenticate the user and persist the session in localStorage
//     try {
//         // By default, sessions are persisted in localStorage and are valid for up to 3 months.
//         // In order to bypass this behavior, pass { saveSession: false } to the connectUser method.
//         const authResult: OrbisConnectResult = await orbisdb.connectUser({ auth }); 
//         if(authResult?.user) {
//             return authResult.user;
//             //setUser(authResult.user);
//         }
//         console.log("authResult:", authResult);
//         return "";
//     } catch(e) {
//         console.log("Error connecting user:", e);
//         return "";
//     }
// }