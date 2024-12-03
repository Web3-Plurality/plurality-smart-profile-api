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
            description: 'OAuth service'
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
    ],
    host: 'app.plurality.local:443',
    schemes: ['https'],
};

swaggerAutogen(outputFile, endpointsFiles, doc)
console.log('Swagger JSON generated')
// .then(() => {
//   require('./src/app'); // Start your app after Swagger doc is generated
// });
