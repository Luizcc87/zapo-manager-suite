import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/server';
import { McpContext } from '../mcp/tools';
import { prisma } from '../lib/prisma';

const router = Router();

const transportsCache = new Map<string, { transport: StreamableHTTPServerTransport; server: any }>();

async function resolveAuth(req: Request, apiKeyParam?: string): Promise<McpContext | null> {
  const requestKey =
    apiKeyParam ||
    req.get('apikey') ||
    req.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!requestKey) return null;

  if (requestKey === process.env.GLOBAL_API_KEY) {
    return { apiKey: requestKey, type: 'global' };
  }

  const instance = await prisma.instance.findFirst({
    where: { apiKey: requestKey },
  });

  if (instance) {
    return { apiKey: requestKey, type: 'instance', instanceName: instance.instanceName };
  }

  return null;
}

function setMcpCorsHeaders(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, authorization');
}

async function getOrCreateSession(auth: McpContext) {
  const sessionId = auth.apiKey;
  if (!transportsCache.has(sessionId)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });
    const server = createMcpServer(auth);
    await server.connect(transport);
    transportsCache.set(sessionId, { transport, server });
  }
  return transportsCache.get(sessionId)!;
}

router.all('/', async (req: Request, res: Response) => {
  setMcpCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  const auth = await resolveAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized: Missing or Invalid API Key' });
  }

  try {
    const { transport } = await getOrCreateSession(auth);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('[MCP Route Error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal MCP Transport Error' });
    }
  }
});

router.all('/:apiKey', async (req: Request, res: Response) => {
  setMcpCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  const auth = await resolveAuth(req, req.params.apiKey);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key in URL' });
  }

  try {
    const { transport } = await getOrCreateSession(auth);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('[MCP Route Error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal MCP Transport Error' });
    }
  }
});

export default router;
