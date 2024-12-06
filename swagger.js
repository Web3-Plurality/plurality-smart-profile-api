const swaggerAutogen = require('swagger-autogen')();

const outputFile = './swagger_output.json'; // File to write Swagger JSON
const endpointsFiles = ['./src/index.ts']; // File(s) containing API routes


const doc = {
    info: {
        title: 'Plurality API',
        description: 'Description of Plurality API',
    },
    components: {
        schemas: {
            smartProfile: {
                username: "",
                avatar: "",
                bio: "",
                interests: [],
                scores: [{
                    scoreType: "",
                    scoreValue: 0,
                  }
                  ],
                reputationTags: [],
                badges: [],
                collections: [],
                extra: [{
                    field: "",
                    value: 0,
                }],
                linkedAddress: [{
                    chainName: "",
                    chainId: "",
                    address: ""
                }],
                connectedProfiles: [{
                    platformName: "",
                    userPlatformId: "",
                    username: "",
                }],
                connectedPlatforms: [],
                attestation: {}
            }
        }
    },
    tags: [
        {
            name: 'Users',  // Tag name
            description: 'user service'  // Tag description
        },

        {
            name: 'Client App',
            description: 'client app service'
        },
        {
            name: 'OAuth-Facebook',
            description: `OAuth Service:

To use OAuth with Facebook, follow these steps:

1. Register the Event:
   Open the following URL in your browser to register the event:
   https://app.plurality.local/register-event/
   Copy the sseId from the response.

2. Obtain the Access Token ID:
   Open a new browser tab and use the sseId in the following endpoint:
   https://app.plurality.local/oauth-facebook?sse_id=<your sseId>
   This will provide you with the accessTokenId.

3. Set Headers and Fetch the Access Token:
   In Swagger UI:
     - Add the following headers:
       - x-sse-id: Your sseId
       - x-token-id: Your accessTokenId
     - Include the clientId in the request body.

   You will receive the final access token in the browser tab where you registered the event.` 
             
        },
        {
            name: 'OAuth-Fortnite',
            description: 'OAuth service'
        },
        {
            name: 'OAuth-Instagram',
            description: 'OAuth service'
        },
        {
            name: 'OAuth-Roblox',
            description: 'OAuth service'
        },
        {
            name: 'OAuth-Snapchat',
            description: 'OAuth service'
        },
        {
            name: 'OAuth-TikTok',
            description: 'OAuth service'
        },
        {
            name: 'OAuth-Twitter',
            description: 'OAuth service'
        },
        {
            name: 'Test',
            description: 'for api testing'
        },
        {
            name: 'SSE',
            description: 'Server sent events'
        },
        
    ],
    host: 'app.plurality.local:443',
    schemes: ['https'],
};

swaggerAutogen(outputFile, endpointsFiles, doc)
console.log('Swagger JSON generated')
// .then(() => {
//   require('./src/app'); // Start your app after Swagger doc is generated
// });
