const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const swaggerConfigs = {
  plurality: {
    outputFile: './src/swagger-plurality.json',
    endpointsFiles: ['./src/index.ts'],
    doc: {
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
          name: 'OAuth',
          description: 'OAuth service'
        },
        {
          name: 'Client App',
          description: 'client app service'
        },

      ],
      servers: [
        {
          url: `https://${process.env.PLURALITY_BACKEND}`,
          description: ""
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    },
    excludePaths: [
      {
        path: '/crm/client-app/',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      {
        path: '/crm/client-app/{id}',
        methods: ['PUT', 'DELETE']
      },
      {
        path: '/crm/client-app/rotate-secret/{id}',
        methods: ['PUT']
      },
      {
        path: '/crm/client/login',
        methods: ['POST']
      },
      {
        path: '/crm/client/authenticate',
        methods: ['POST']
      },
      {
        path: '/crm/client/',
        methods: ['GET', 'POST']
      },
      {
        path: '/user/validate',
        methods: ['POST']
      }
    ]
  },
  developer: {
    outputFile: './src/swagger-developer.json',
    endpointsFiles: ['./src/index.ts'],
    doc: {
      info: {
        title: 'Plurality Developer Dashboard API',
        description: 'API endpoints for the developer dashboard',
        version: "1.0.0",
      },
      tags: [
        {
          name: 'Client App',
          description: 'client app service'
        },
        {
          name: 'Auth',
          description: 'Auth service'
        }
      ],
      servers: [
        {
          url: `https://${process.env.PLURALITY_BACKEND}`,
          description: ""
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    },
    includePaths: [
      {
        path: '/crm/client-app/',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      {
        path: '/crm/client-app/{id}',
        methods: ['GET', 'PUT', 'DELETE']
      },
      {
        path: '/crm/client-app/rotate-secret/{id}',
        methods: ['PUT']
      },
      {
        path: '/crm/client/login',
        methods: ['POST']
      },
      {
        path: '/crm/client/authenticate',
        methods: ['POST']
      },
      {
        path: '/crm/client/',
        methods: ['GET', 'POST']
      }
    ]
  },
  client: {
    outputFile: './src/swagger-client.json',
    endpointsFiles: ['./src/index.ts'],
    doc: {
      info: {
        title: 'Plurality Client API',
        description: 'API endpoints for client validation',
        version: "1.0.0",
      },
      tags: [
        {
          name: 'Users',
          description: 'User validation service'
        }
      ],
      servers: [
        {
          url: "https://app.plurality.local",
          description: ""
        }
      ],
      components: {
        securitySchemes: {
          basicAuth: {
            type: "http",
            scheme: "basic"
          }
        }
      }
    },
    includePaths: [
      {
        path: '/user/validate',
        methods: ['POST']
      }
    ]
  }
};

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


const googleOauthDescription = `
 
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



const docForDevDashboard = {
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
      name: 'Client App',
      description: 'client app service'
    },

  ],
  servers: [
    {
      url: `https://${process.env.PLURALITY_BACKEND}`,
      description: ''
    },

  ],
  components: {
    securitySchemes: {
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


const docForPluralityDashboard = {
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
  ],
  servers: [
    {
      url: `https://${process.env.PLURALITY_BACKEND}`,
      description: ''
    },

  ],
  components: {
    securitySchemes: {
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



async function generateSwagger(name, config) {
  await swaggerAutogen(config.outputFile, config.endpointsFiles, config.doc);
  console.log(`Swagger JSON generated for ${config.doc.info.title}`);

  setTimeout(() => {
    console.log(`Modifying swagger file: ${config.outputFile}`);
    const swaggerData = JSON.parse(fs.readFileSync(config.outputFile, 'utf-8'));
    const filteredPaths = {};

    if (name === 'developer') {
      // Include only specified paths and methods
      for (const [path, methods] of Object.entries(swaggerData.paths)) {
        const matchingConfig = config.includePaths.find(p => path === p.path);
        if (matchingConfig) {
          filteredPaths[path] = {};
          // Only include specified HTTP methods
          for (const [method, methodConfig] of Object.entries(methods)) {
            if (matchingConfig.methods.includes(method.toUpperCase())) {
              filteredPaths[path][method] = methodConfig;
            }
          }
        }
      }
    } if (name === 'client') {
      // Include only specified paths and methods
      for (const [path, methods] of Object.entries(swaggerData.paths)) {
        const matchingConfig = config.includePaths.find(p => path === p.path);
        if (matchingConfig) {
          filteredPaths[path] = {};
          // Only include specified HTTP methods
          for (const [method, methodConfig] of Object.entries(methods)) {
            if (matchingConfig.methods.includes(method.toUpperCase())) {
              filteredPaths[path][method] = methodConfig;
            }
          }
        }
      }
    }
    else if (name === 'plurality') {
      // Include all paths except excluded ones
      for (const [path, methods] of Object.entries(swaggerData.paths)) {
        const matchingConfig = config.excludePaths.find(p => path === p.path);
        if (!matchingConfig) {
          // Include all methods for non-excluded paths
          filteredPaths[path] = methods;
        } else {
          // For excluded paths, only include non-excluded methods
          filteredPaths[path] = {};
          for (const [method, methodConfig] of Object.entries(methods)) {
            if (!matchingConfig.methods.includes(method.toUpperCase())) {
              filteredPaths[path][method] = methodConfig;
            }
          }
        }
      }

      // Add custom descriptions for event endpoints
      for (const [path, methods] of Object.entries(filteredPaths)) {
        if (path.includes('/event')) {
          const match = path.match(/-(.*?)\//);
          if (match) {
            // Replace placeholder with actual domain value
            filteredPaths[path]['post']['description'] = generateDescription(match[1]);
            if (match[1] === 'facebook') {
              filteredPaths[path]['post']['tags'] = ['OAuth'];
            }
          }
          else if (path.includes('/google/event')) {
            filteredPaths[path]['post']['description'] = googleOauthDescription;
          }
        }
      }
    }

    swaggerData.paths = filteredPaths;
    fs.writeFileSync(config.outputFile, JSON.stringify(swaggerData, null, 2));
    console.log(`Swagger output updated successfully for ${config.doc.info.title}!`);
  }, 5000);
}

async function main() {
  for (const [name, config] of Object.entries(swaggerConfigs)) {
    await generateSwagger(name, config);
  }
}

main();
