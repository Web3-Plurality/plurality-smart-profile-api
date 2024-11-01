// maps -> this should go to redis cache if we convert to microservice
export const memoryStoreToken = new Map(); // key: token uuid, value: access token
export const memoryStoreSSE = new Map(); // key: sse uuid , value: response
export const memoryStoreNonce = new Map(); // key: address, value: nonce
export const memoryStoreProfile = new Map(); // key: unique session uuid , value: smart profile


// scores Field -> this should go to database if we convert to microservice
export enum SCORE_TYPES {
  REPUTATION_SCORE = "reputation_score",
  SOCIAL_SCORE = "social_score"
}
