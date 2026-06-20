import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export function checkGlobalApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.get('apikey') !== process.env.GLOBAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Global API Key' });
  }
  next();
}

export async function checkInstanceApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { instanceName } = req.params;
    if (!instanceName) {
      return res.status(400).json({ error: 'instanceName parameter is required' });
    }
    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    const requestKey = req.get('apikey');
    if (instance.apiKey !== requestKey && process.env.GLOBAL_API_KEY !== requestKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function checkStrictInstanceApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { instanceName } = req.params;
    if (!instanceName) {
      return res.status(400).json({ error: 'instanceName parameter is required' });
    }

    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const requestKey = req.get('apikey');
    if (instance.apiKey !== requestKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Instance API Key' });
    }

    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
