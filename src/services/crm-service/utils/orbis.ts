import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// Declare the variables for dynamically imported modules
/* eslint-disable */
// @ts-ignore
let orbisSDK: typeof import('@useorbis/db-sdk');
// @ts-ignore
let orbisSDKAuth: typeof import('@useorbis/db-sdk/auth');
/* eslint-enable */

// Function to initialize the Orbis SDKs
async function initializeOrbisSDKs() {
  orbisSDK = await import('@useorbis/db-sdk');
  orbisSDKAuth = await import('@useorbis/db-sdk/auth');
}

// OrbisDB instance, to be initialized after SDKs are loaded
let orbisdb: InstanceType<typeof orbisSDK.OrbisDB>;

// Initialize the OrbisDB instance
async function initializeOrbisDB() {
  if (!orbisSDK) {
    throw new Error('Orbis SDK is not initialized. Call initializeOrbisSDKs first.');
  }

  orbisdb = new orbisSDK.OrbisDB({
    ceramic: {
      gateway: process.env.CERAMIC_URL || '',
    },
    nodes: [
      {
        gateway: process.env.ORBIS_NODE_URL || '',
        env: process.env.ORBIS_ENV,
      },
    ],
  });
}

// Shared data
/* eslint-disable */
const data = {
  contexts: {
    plurality: process.env.ORBIS_PLURALITY_CONTEXT,
  },
  models: {
    profile_type_model: process.env.ORBIS_PROFILE_TYPE_MODEL,
  },
};
/* eslint-enable */
// Function to connect to Orbis using DID PKH
export async function connectOrbisDidPkh() {
  if (!orbisdb) {
    throw new Error('OrbisDB is not initialized. Call initializeOrbisDB first.');
  }

  const provider: any = new ethers.Wallet(process.env.PUBLIC_DAPP_OWNER_WALLET_PRIVATE_KEY || '');
  const auth = new orbisSDKAuth.OrbisEVMAuth(provider);

  try {
    const authResult = await orbisdb.connectUser({ auth });

    if (authResult?.user) {
      return authResult.user;
    }
    console.log('authResult:', authResult);
    return '';
  } catch (error) {
    console.error('Error connecting user:', error);
    return '';
  }
}

// Function to insert a profile type
export async function insertProfileType(profileName: string, description: string) {
  if (!orbisdb) {
    throw new Error('OrbisDB is not initialized. Call initializeOrbisDB first.');
  }
  /* eslint-disable */
  const insertStatement = orbisdb
    .insert(data.models.profile_type_model || '')
    .value({
      profile_name: profileName,
      platforms:
        '[{"platform":"Instagram","authentication":false},{"platform":"Meta","authentication":false},{"platform":"Twitter","authentication":true},{"platform":"TikTok","authentication":true},{"platform":"Roblox","authentication":true},{"platform":"Snapchat","authentication":true}]',
      version: '1.0',
      description: description,
    })
    .context(process.env.ORBIS_PLURALITY_CONTEXT || '');
  /* eslint-enable */
  // Perform validation
  const validation = await insertStatement.validate();
  if (!validation.valid) {
    throw new Error('Error during validation: ' + validation.error);
  }

  try {
    const result = await insertStatement.run();
    console.log('Insert result:', result);
    return result;
  } catch (error) {
    console.error('Error running insert statement:', error);
  }

  console.log('Insert statement runs:', insertStatement.runs);
}

export async function updateProfileType(streamId: string, profileName: string, description: string) {
  // This will perform a shallow merge before updating the document
  // { ...oldContent, ...newContent }
  if (!orbisdb) {
    throw new Error('OrbisDB is not initialized. Call initializeOrbisDB first.');
  }
  /* eslint-disable */
  const updateStatement = await orbisdb.update(streamId).set({
    profile_name: profileName,
    description: description,
  });
  /* eslint-enable */
  try {
    const result = await updateStatement.run();
    return result;
  } catch (error) {
    console.log(error);
  }
}

export async function selectProfileType(streamId: string) {
  try {
    /* eslint-disable */
    const selectStatement = await orbisdb
      .select()
      .from(data.models.profile_type_model || '')
      // .where({
      //   stream_id: streamId,
      // })
      .context(process.env.ORBIS_PLURALITY_CONTEXT || '');
    /* eslint-enable */
    const query = selectStatement.build();
    console.log('Query that will be run', query);
    const result = await selectStatement.run();
    console.log(result);
      return result
    // const { columns, rows } = result
    // console.log("select first: ", { columns, rows, neededPlatforms });
    // return { columns, rows, neededPlatforms };
  } catch (error) {
    console.log('Error', error);
  }
}

// Call this function to initialize everything before running other functions
export async function initializeOrbis() {
  await initializeOrbisSDKs();
  await initializeOrbisDB();
}
