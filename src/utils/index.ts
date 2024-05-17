import  { Request, Response } from "express";


export const activeConnections = new Map();

export function parseQueryString(query: string) {
    let params : any = {};
    // Remove the leading question mark if present
    query = query.replace(/^\?/, '');
    // Split the query string on '&'
    const pairs = query.split('&');
    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        params[key]  = decodeURIComponent(value || '');
    });
    return params;
}



export function isAuthenticated(req: Request, res: Response, next) {
    if (req.sessionID && req?.session?.user?.accessToken) {
      // User is authenticated
      return next();
    }
    // User is not authenticated
    res.status(401).send("You need to log in.");
  }


export function initSSE(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: {"message":"Connection established"}\n\n`);
  activeConnections.set(req.sessionID, res);
}
