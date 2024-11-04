import { v4 as uuidv4 } from 'uuid';
import express, { Request, Response } from 'express';
import { memoryStoreSSE } from '../../../utils/global';

export const sseRouter = express.Router();

export function initSSE(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const sseID = uuidv4();
  memoryStoreSSE.set(sseID, res);
  res.write(`data: {"message":"Connection established", "id":"${sseID}"}\n\n`);
}

sseRouter.get('/', async (req: Request, res: Response) => {
  initSSE(req, res);
});
