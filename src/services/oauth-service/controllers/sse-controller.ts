import { v4 as uuidv4 } from 'uuid';
import express, { Request, Response } from 'express';
import { memoryStoreSSE } from '../../../utils/global';

export const sseRouter = express.Router();

export function initSSE(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', // eslint-disable-line
    'Cache-Control': 'no-cache', // eslint-disable-line
    Connection: 'keep-alive', // eslint-disable-line
  });
  const sseID = uuidv4();
  memoryStoreSSE.set(sseID, res);
  res.write(`data: {"message":"Connection established", "id":"${sseID}"}\n\n`);
}

sseRouter.get('/', async (req: Request, res: Response) => {
  // #swagger.tags = ['SSE']
  // #swagger.ignore = true
  initSSE(req, res);
});
