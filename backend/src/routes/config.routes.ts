import { Router, Request, Response } from 'express';
import { ProxyAgent } from 'undici';
import { prisma } from '../lib/prisma';
import { checkInstanceApiKey } from '../middleware/auth';

const router = Router();

async function testProxyConnectivity(cfg: any): Promise<{
  connected: boolean;
  externalIp?: string;
  latencyMs: number;
  error?: string;
}> {
  const CHECK_URL = 'https://api.ipify.org?format=json';
  const protocol = (cfg.protocol as string) || 'http';

  // Apply same username suffix logic as buildProxy in manager.ts
  let effectiveUser: string = cfg.username || '';
  if (effectiveUser) {
    if (cfg.country) effectiveUser += `-${(cfg.country as string).toLowerCase()}`;
    if (cfg.session) effectiveUser += `-${cfg.session}`;
  }
  const auth = effectiveUser && cfg.password
    ? `${encodeURIComponent(effectiveUser)}:${encodeURIComponent(cfg.password)}@`
    : effectiveUser && !cfg.password
    ? `${encodeURIComponent(effectiveUser)}@`
    : '';
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
  country: '',  // optional 2-letter ISO code for geographic targeting
  session: '',  // optional sticky session ID (auto-set to instanceName when blank)
};


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

// ── Proxy Replace ─────────────────────────────────────────────────────────────

router.post('/proxy/replace/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  const replaceApiUrl = process.env.PROXY_REPLACE_API_URL;
  const replaceApiKey = process.env.PROXY_REPLACE_API_KEY;

  if (!replaceApiUrl || !replaceApiKey) {
    return res.status(501).json({ error: 'PROXY_REPLACE_API_URL and PROXY_REPLACE_API_KEY are not configured' });
  }

  try {
    const instance = await prisma.instance.findUnique({ where: { instanceName: req.params.instanceName } });
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const cfg = (instance.proxyConfig as any) ?? {};
    if (!cfg.host) return res.status(400).json({ error: 'No proxy host configured for this instance' });

    const body = {
      to_replace: { type: 'ip_address', ip_addresses: [cfg.host] },
      replace_with: [{ type: 'any', count: 1 }],
    };

    const response = await fetch(replaceApiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Token ${replaceApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
