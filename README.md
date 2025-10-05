# Steps for making a new deployment

## Build the image and push
Use this repo to build and push to docker hub

## Create Oasis project
Create a new directory for Oasis, do the following calls
```
oasis rofl init
oasis rofl create --network testnet
```
Copy the compose.yaml.example file to the newly created directory, rename it to compose.yaml, and modify the ```image``` filed with the image that has been created in the first step
Run the following command
```
oasis rofl build
```
You need to create a ```.env``` file in the new folder and fills in. Then do
```
oasis rofl secret import .env
oasis rofl update
oasis rofl deploy
```
Hint: you may need to top up your oasis account first by getting some TEST token from the faucet https://faucet.testnet.oasis.io/
```
oasis account show
```
After deployment you can check the status of deployment by using
```
oasis rofl machine show
```
It may take some time after the deployment because the applciation needs to start, you can check once the app is ready by its swagger https://p5000.m766.test-proxy-b.rofl.app/docs-client/

## Common Errors:
1. Oasis update failed with error msg ```insufficient gas```, try to do ```oasis rofl update --gas-limit XXXXXX```
2. Deployment failed with error msg ```no space left```, manually change in ```rofl.yml``` the disk to sth like ```17000``` instead of using ```20000```
3. Deployment failed with error msg ```can not find the node```, manually delete the ```machines``` section in ```rofl.yml``` and redo ```oasis rofl update``` then ```oasis rofl deploy```
4. The deployment mahcine goes down after sometime, you need to top it up after the deployment ```oasis rofl machine top-up --term hour --term-count <hours>```
