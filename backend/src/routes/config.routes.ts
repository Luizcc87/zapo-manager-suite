import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProxyAgent } from 'undici';

const prisma = new PrismaClient();
const router = Router();

async function testProxyConnectivity(cfg: any): Promise<{
  connected: boolean;
  externalIp?: string;
  latencyMs: number;
  error?: string;
}> {
  const CHECK_URL = 'https://api.ipify.org?format=json';
  const auth = cfg.username && cfg.password
    ? `${encodeURIComponent(cfg.username)}:${encodeURIComponent(cfg.password)}@`
    : '';
  const protocol = (cfg.protocol as string) || 'http';
  const proxyUrl = `${protocol}://${auth}${cfg.host}:${cfg.port}`;
  const start = Date.now();

  try {
    if (protocol === 'socks4' || protocol === 'socks5') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SocksProxyAgent } = require('socks-proxy-agent');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require('https');
      const agent = new SocksProxyAgent(proxyUrl);
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(CHECK_URL, { agent }, (res: any) => {
          let body = '';
          res.on('data', (chunk: any) => { body += chunk; });
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const json = JSON.parse(data) as { ip: string };
      return { connected: true, externalIp: json.ip, latencyMs: Date.now() - start };
    }

    // HTTP / HTTPS — undici ProxyAgent supports both
    const dispatcher = new ProxyAgent(proxyUrl);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetch: undiciFetch } = require('undici');
    const res = await (undiciFetch as typeof fetch)(CHECK_URL, { dispatcher } as any);
    const json = await res.json() as { ip: string };
    return { connected: true, externalIp: json.ip, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { connected: false, latencyMs: Date.now() - start, error: err.message };
  }
}

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

// ── Proxy Status ──────────────────────────────────────────────────────────────

router.get('/proxy/status/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const instance = await prisma.instance.findUnique({ where: { instanceName: req.params.instanceName } });
    const cfg = (instance?.proxyConfig as any) ?? {};

    if (!cfg.enabled || !cfg.host || !cfg.port) {
      return res.json({ enabled: false, connected: false });
    }

    const protocol = cfg.protocol || 'http';
    const proxyUrl = `${protocol}://${cfg.host}:${cfg.port}`; // no credentials

    const result = await testProxyConnectivity(cfg);
    return res.json({ enabled: true, protocol, proxyUrl, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
