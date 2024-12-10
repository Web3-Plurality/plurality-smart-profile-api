const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'});
const dotenv = require('dotenv');
dotenv.config();

const outputFile = './swagger_output.json'; // File to write Swagger JSON
const endpointsFiles = ['./src/index.ts']; // File(s) containing API routes


function generateDescription(platformName) {
    return `
  Using OAuth with ${platformName}
  1. You have to Login in plurality by any method and get plurality token.
  
  2. Register the Event
     - Navigate to the following URL in your browser to register the event:  
       https://${process.env.PLURALITY_DOMAIN}/register-event/
     - Copy the sseId from the response. This will be used in subsequent steps.
  
  3. Obtain the Access Token ID
     - Open a new browser tab and use the sseId obtained in step 1 with the following endpoint:  
       https://${process.env.PLURALITY_DOMAIN}/oauth-${platformName.toLowerCase()}?sse_id=<your_sseId>
     - This will return the accessTokenId, which is required for the next step.
  
  3. Set Headers and and call the event endpoint to tell server that you got the accessTokenId successfully.
     - In Swagger UI, make a request with the following:  
       - Headers:  
         - x-sse-id: Your sseId  
         - x-token-id: Your accessTokenId  
  
  4. Fetch User Information
     - To retrieve user information, call the info endpoint in Swagger UI:  
       - Headers:  
         - Authorization: Bearer <PluralityAccessToken>  
         - x-token-id: <accessTokenId>
       - The user information will be returned in the response.
    `;
  }
  

  const googleOauthDescription=`
    1. Register the Event
     - Navigate to the following URL in your browser to register the event:  
       https://${process.env.PLURALITY_DOMAIN}/register-event/
     - Copy the sseId from the response. This will be used in subsequent steps.
  
    2. Obtain the Access Token ID
     - Open a new browser tab and use the sseId obtained in step 1 with the following endpoint:  
       https://${process.env.PLURALITY_DOMAIN}/user/auth/google/login?sse_id=<your_sseId>
     - This will return the accessTokenId, which is required for the next step.
  
    3. Set Headers and and call the event endpoint to tell server that you got the accessTokenId successfully.
     - In Swagger UI, make a request with the following:  
       - Headers:  
         - x-sse-id: Your sseId  
         - x-token-id: Your accessTokenId  
       - Body:  
         - redirect: false  
         - clientId: Client ID get from plurality
    This will give the accessToken in register event tab
    `;



const doc = {
    info: {
        title: 'Plurality API',
        description: 'Description of Plurality API',
        version: "1.0.0",
    },
    tags: [
        {
            name: 'Auth',
            description: 'Auth service'
        },
        {
            name: 'Users-OAuth-Google',
            description: googleOauthDescription
        },
        {
            name: 'Users',
            description: 'user service' 
        },
        {
            name: 'Client App',
            description: 'client app service'
        },
        {
            name: 'OAuth-Facebook',
            description: generateDescription('Facebook')

        },
        {
            name: 'OAuth-Fortnite',
            description: generateDescription('Fortnite')
        },
        {
            name: 'OAuth-Instagram',
            description: generateDescription('Instagram')
        },
        {
            name: 'OAuth-Roblox',
            description: generateDescription('Roblox')
        },
        {
            name: 'OAuth-Snapchat',
            description: generateDescription('Snapchat')
        },
        {
            name: 'OAuth-TikTok',
            description: generateDescription('TikTok')
        },
        {
            name: 'OAuth-Twitter',
            description: generateDescription('Twitter')
        },

        // {
        //     name: 'Test',
        //     description: 'for api testing'
        // },
        // {
        //     name: 'SSE',
        //     description: 'Server sent events'
        // },

    ],
    servers: [
        {
          url: 'https://app.plurality.local',
          description: ''
        },
       
      ],
      components: {
        securitySchemes:{
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
        }
    }
}
};

swaggerAutogen(outputFile, endpointsFiles, doc)
console.log('Swagger JSON generated')
// .then(() => {
//   require('./src/app'); // Start your app after Swagger doc is generated
// });
