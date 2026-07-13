import { Router, Request, Response } from 'express';
import { ProxyAgent } from 'undici';
import { prisma } from '../lib/prisma';
import { checkInstanceApiKey } from '../middleware/auth';
import { ZapoManager, testProxyConnectivity } from '../manager';

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
  base64: false,
  byEvents: false,
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

    if (data.enabled && data.host && data.port) {
      const test = await testProxyConnectivity(data);
      ZapoManager.proxyStatusCache.set(req.params.instanceName, {
        connected: test.connected,
        error: test.error,
        details: test.details
      });
      if (!test.connected) {
        return res.status(400).json({
          response: {
            message: `Falha na conexão com o proxy: ${test.error}${test.details ? ` (${test.details})` : ''}`
          }
        });
      }
    } else {
      ZapoManager.proxyStatusCache.delete(req.params.instanceName);
    }

    await prisma.instance.update({
      where: { instanceName: req.params.instanceName },
      data: { proxyConfig: data },
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({
      response: {
        message: err.message
      }
    });
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
    ZapoManager.proxyStatusCache.set(req.params.instanceName, {
      connected: result.connected,
      error: result.error,
      details: result.details
    });
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
