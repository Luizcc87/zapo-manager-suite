import { Router, Request, Response } from 'express';
import { ProxyAgent } from 'undici';
import { prisma } from '../lib/prisma';
import { checkInstanceApiKey } from '../middleware/auth';
import { ZapoManager, testProxyConnectivity } from '../manager';
import { recordInstanceEvent } from '../services/instanceEvents';
import { deleteNotificationChannel, listNotificationChannels, upsertNotificationChannel } from '../services/notificationChannels';
import { sendTelegramAlert } from '../services/telegramAlerts';

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

router.get('/notification/channels/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const channels = await listNotificationChannels(req.params.instanceName);
    return res.json({ instanceName: req.params.instanceName, channels });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/notification/channels/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const channel = await upsertNotificationChannel(req.params.instanceName, undefined, req.body);
    return res.status(201).json(channel);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/notification/channels/:instanceName/:channelId', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const channel = await upsertNotificationChannel(req.params.instanceName, req.params.channelId, req.body);
    return res.json(channel);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/notification/channels/:instanceName/:channelId', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const result = await deleteNotificationChannel(req.params.instanceName, req.params.channelId);
    if (result.count === 0) return res.status(404).json({ error: 'Channel not found' });
    return res.json({ status: 'success', channelId: req.params.channelId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/notification/channels/:instanceName/:channelId/test', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const channels = await listNotificationChannels(req.params.instanceName);
    const channel = channels.find((item) => item.id === req.params.channelId && item.type === 'telegram' && item.enabled);
    if (!channel) return res.status(404).json({ error: 'Telegram channel not found' });

    const sent = await sendTelegramAlert({
      instanceName: req.params.instanceName,
      type: 'operational.summary',
      severity: 'info',
      title: 'Teste de notificacao Telegram',
      summary: `Mensagem de teste enviada pelo Zapo Manager para a instancia ${req.params.instanceName}.`,
      dedupeKey: `${req.params.instanceName}:notification.test:${Date.now()}`,
    });

    if (!sent) {
      return res.status(502).json({ error: 'Telegram test message was not sent' });
    }

    return res.json({ status: 'sent', channelId: req.params.channelId });
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
        recordInstanceEvent({
          instanceName: req.params.instanceName,
          type: 'proxy.test_failed',
          severity: 'critical',
          title: 'Falha no proxy da instancia',
          summary: `O teste de conectividade do proxy falhou: ${test.error}`,
          details: { error: test.error, details: test.details, source: 'proxy.set' },
        }).catch(() => {});
        sendTelegramAlert({
          instanceName: req.params.instanceName,
          type: 'proxy.test_failed',
          severity: 'critical',
          title: 'Falha no proxy da instancia',
          summary: `O teste de conectividade do proxy falhou: ${test.error}${test.details ? ` (${test.details})` : ''}`,
          dedupeKey: `${req.params.instanceName}:proxy.test_failed:${test.error || 'unknown'}`,
        }).catch(() => {});
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

    // Se a instância estiver rodando ativamente e proxy habilitado, desconecta para aplicar o novo proxy
    const active = ZapoManager.getActive(req.params.instanceName);
    if (active && data.enabled) {
      console.log(`[ZapoRouter] Configurações de proxy alteradas para ${req.params.instanceName}. Reiniciando conexão para aplicar novo proxy...`);
      ZapoManager.disconnectClient(req.params.instanceName).catch(() => {});
      ZapoManager.connectClient(req.params.instanceName).catch(err => {
        console.error(`[ZapoRouter] Erro ao reconectar ${req.params.instanceName} pós alteração de proxy:`, err.message);
      });
    }

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
    const proxyUrl = `${protocol}://${cfg.host}:${cfg.port}`;
    // Do NOT auto-inject instanceName as session: Webshare session IDs must be
    // numeric and user-configured. Using instanceName causes HTTP 407.
    const proxyConfig = cfg;

    const result = await testProxyConnectivity(proxyConfig);
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
