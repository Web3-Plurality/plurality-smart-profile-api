const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'});
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const outputFile = './src/swagger.json'; // File to write Swagger JSON
const endpointsFiles = ['./src/index.ts']; // File(s) containing API routes


function generateDescription(platformName) {
    return `
  ### Using OAuth with ${platformName}<br>
  
  1. **Login to Plurality and obtain the token**<br> <br>
     Log in to Plurality using any available method to get the Plurality token.<br>
  
  2. **Register the Event**  <br><br>
     Navigate to the following URL to register the event:  <br>
     [Register Event](https://${process.env.PLURALITY_BACKEND}/register-event/)  <br>
     Copy the **sseId** from the response. This will be used in subsequent steps.<br>
  
  3. **Obtain the Access Token ID**  <br><br>
     Open a new browser tab and use the **sseId** obtained in Step 2 with the following endpoint:  <br>
     [Obtain Access Token](https://${process.env.PLURALITY_BACKEND}/oauth-${platformName.toLowerCase()}?sse_id=<your_sseId>)  <br>
     This will return the **accessTokenId**, which is required for the next step.<br>
  
  4. **Set Headers and call the event endpoint**  <br><br>
     Notify the server that you have successfully obtained the **accessTokenId**:  <br>
     - **Headers**:  <br>
       - x-sse-id: Your *sseId*  <br>
       - x-token-id: Your *accessTokenId*  <br>
  
  5. **Fetch User Information**  <br><br>
     To retrieve user information, call the info endpoint in Swagger UI:<br>
     - **Headers**:  <br>
       - Authorization: Bearer *PluralityAccessToken*  <br>
       - x-token-id: *accessTokenId*  <br>
  `;
  }
  

  const googleOauthDescription=`
 
1. **Register the Event**  
   Navigate to the following URL in your browser to register the event:  
     [Register Event](https://${process.env.PLURALITY_BACKEND}/register-event/)  
   Copy the **sseId** from the response. This will be used in subsequent steps.

2. **Obtain the Access Token ID**  
   Open a new browser tab and use the **sseId** obtained in step 1 with the following endpoint:  
     [Obtain Access Token](https://${process.env.PLURALITY_BACKEND}/auth/google/login?sse_id=<your_sseId>)  
   This will return the **accessTokenId**, which is required for the next step.

3. **Set Headers and Call the Event Endpoint**  
   Notify the server that you have successfully obtained the **accessTokenId**:  
    - In Swagger UI, make a request with the following:  
      - **Headers:**  
        - **x-sse-id**: Your **sseId**  
        - **x-token-id**: Your **accessTokenId**  
      - **Body:**  
        - **redirect**: **false**  
        - **clientAppId**: Client App ID obtained from Plurality  

   This will provide the **accessToken** in the "Register Event" tab.
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
            name: 'Users',
            description: 'user service' 
        },
        {
            name: 'Client App',
            description: 'client app service'
        },
        {
            name: 'OAuth',
            description: 'OAuth service'
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
          url: `https://${process.env.PLURALITY_BACKEND}`,
          description: ''
        },
       
      ],
      components: {
        securitySchemes:{
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
        },
        basicAuth: {
          type: 'http',
          scheme: 'basic',
      }
    }
}
};

async function  generateSwagger(){

  swaggerAutogen(outputFile, endpointsFiles, doc)
  console.log('Swagger JSON generated')
}
 function main() {
 generateSwagger().then(()=>{
  
  setTimeout(() => {
    console.log("Modifying swagger file");
    const swaggerData = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    // Loop through all paths in the Swagger JSON
    for (const [path, methods] of Object.entries(swaggerData.paths)) {
      if (path.includes('/event')) {
        const match = path.match(/-(.*?)\//);
        if (match) {
            // Replace placeholder with actual domain value
            swaggerData.paths[path]['post']['description'] = generateDescription(match[1]);
            if (match[1] === 'facebook') {
              swaggerData.paths[path]['post']['tags'] = ['OAuth'];
              
            }
        }
        else if(path.includes('/google/event')){
          swaggerData.paths[path]['post']['description'] = googleOauthDescription;
        
      }
    }
  }
    
  // Save the updated Swagger JSON file
    fs.writeFileSync(outputFile, JSON.stringify(swaggerData, null, 2));
    console.log('Swagger output updated successfully!');
   
  }, 5000);
   
})}

main();