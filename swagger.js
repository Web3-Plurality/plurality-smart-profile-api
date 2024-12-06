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
            description: `OAuth service:\n In order to OAuth with facebook you have to do following steps:\n
             1. register the event by open this https://app.plurality.local/register-event/ end point in browser, copy the sseId \n
             2. open the the new tab and paste sseID in the endpoint https://app.plurality.local/oauth-facebook?sse_id=<your sse id>, you will get the access tokenID\n
             3. open the new tab and paste the access token in the endpoint https://app.plurality.local/oauth-facebook/event?access_token=<your access token>, you will get the user profile\n` 
             
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
