import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const DEFAULT_SETTINGS = {
  rejectCall: false,
  msgCall: '',
  groupsIgnore: false,
  alwaysOnline: false,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false,
};

const DEFAULT_WEBHOOK = {
  enabled: false,
  url: '',
  events: [],
  webhookBase64: false,
  webhookByEvents: false,
};

const DEFAULT_PROXY = {
  enabled: false,
  host: '',
  port: '',
  protocol: 'http',
  username: '',
  password: '',
};

async function checkInstanceApiKey(req: Request, res: Response, next: any) {
  try {
    const { instanceName } = req.params;
    const requestKey = req.get('apikey');
    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    const globalApiKey = process.env.GLOBAL_API_KEY;
    if (instance.apiKey !== requestKey && globalApiKey !== requestKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings/find/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const instance = await prisma.instance.findUnique({ where: { instanceName: req.params.instanceName } });
    return res.json({ ...(DEFAULT_SETTINGS), ...(instance?.settingsConfig as object ?? {}) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/settings/set/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const data = { ...DEFAULT_SETTINGS, ...req.body };
    await prisma.instance.update({
      where: { instanceName: req.params.instanceName },
      data: { settingsConfig: data },
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Webhook ───────────────────────────────────────────────────────────────────

router.get('/webhook/find/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const instance = await prisma.instance.findUnique({ where: { instanceName: req.params.instanceName } });
    return res.json({ ...(DEFAULT_WEBHOOK), ...(instance?.webhookConfig as object ?? {}) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/webhook/set/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    // frontend envia { webhook: { ... } }
    const payload = req.body?.webhook ?? req.body;
    const data = { ...DEFAULT_WEBHOOK, ...payload };
    await prisma.instance.update({
      where: { instanceName: req.params.instanceName },
      data: { webhookConfig: data },
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Proxy ─────────────────────────────────────────────────────────────────────

router.get('/proxy/find/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const instance = await prisma.instance.findUnique({ where: { instanceName: req.params.instanceName } });
    return res.json({ ...(DEFAULT_PROXY), ...(instance?.proxyConfig as object ?? {}) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/proxy/set/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const data = { ...DEFAULT_PROXY, ...req.body };
    await prisma.instance.update({
      where: { instanceName: req.params.instanceName },
      data: { proxyConfig: data },
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
