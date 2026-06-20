import { createStore, WaClient, ConsoleLogger } from 'zapo-js';
import { getMobileDevice } from './config/device';
import { createPostgresStore } from '@zapo-js/store-postgres';
import { createRedisStore } from '@zapo-js/store-redis';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { ProxyAgent } from 'undici';
import { prisma } from './lib/prisma';
const activeClients = new Map<string, {
  client: WaClient;
  pgStore?: any;
  redisClient?: any;
  poller?: any;
  qrCode?: string;
  lockInterval?: NodeJS.Timeout;
  messageStatus?: Map<string, any>;
}>();

// In-memory chat/message store (populated by message events)
const chatMessages = new Map<string, Map<string, any[]>>(); // instanceName -> remoteJid -> messages[]
const chatList     = new Map<string, Map<string, any>>();    // instanceName -> remoteJid -> chat

// Socket.io emitter — set by main.ts after server startup
let _socketEmitter: ((event: string, payload: any) => void) | null = null;

// Redis para Locks de Concorrência (Docker Swarm safety)
const redisLockClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const LOCK_TIMEOUT = 30000; // 30s TTL
const LOCK_RENEW = 10000;   // 10s renovação

async function acquireLock(instanceName: string, containerId: string): Promise<boolean> {
  if (!redisLockClient) return true;
  const lockKey = `lock:zapo:${instanceName}`;
  const acquired = await redisLockClient.set(lockKey, containerId, 'PX', LOCK_TIMEOUT, 'NX');
  return acquired === 'OK';
}

async function renewLock(instanceName: string, containerId: string): Promise<boolean> {
  if (!redisLockClient) return true;
  const lockKey = `lock:zapo:${instanceName}`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  const result = await redisLockClient.eval(script, 1, lockKey, containerId, LOCK_TIMEOUT);
  return result === 1;
}

async function releaseLock(instanceName: string, containerId: string): Promise<void> {
  if (!redisLockClient) return;
  const lockKey = `lock:zapo:${instanceName}`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redisLockClient.eval(script, 1, lockKey, containerId);
}

const CONTAINER_ID = process.env.HOSTNAME || Math.random().toString(36).substring(7);

async function buildStore(instanceName: string): Promise<{ store: any; pgStore: any; redisClient: any; poller: any }> {
  let pgStore: any = null;
  let redisClient: any = null;
  let poller: any = null;
  let storeBackend: any;

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    pgStore = createPostgresStore({
      pool: new Pool({ connectionString: dbUrl }),
      tablePrefix: 'wa_'
    });
    poller = pgStore.startCleanup(instanceName);
    storeBackend = pgStore;
  } else {
    const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
    const dir = path.dirname(sqlitePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    storeBackend = createSqliteStore({ path: sqlitePath });
  }

  const saveMessages = process.env.SAVE_DATA_NEW_MESSAGE === 'true';
  const saveContacts = process.env.SAVE_DATA_CONTACTS === 'true';

  let providersConfig: any = {
    auth: pgStore ? 'pg' : 'sqlite',
    signal: pgStore ? 'pg' : 'sqlite',
    preKey: pgStore ? 'pg' : 'sqlite',
    session: pgStore ? 'pg' : 'sqlite',
    identity: pgStore ? 'pg' : 'sqlite',
    senderKey: pgStore ? 'pg' : 'sqlite',
    appState: pgStore ? 'pg' : 'sqlite',
    privacyToken: pgStore ? 'pg' : 'sqlite',
    messages: saveMessages && pgStore ? 'pg' : 'none',
    threads: 'none',
    contacts: saveContacts && pgStore ? 'pg' : 'none'
  };

  if (process.env.REDIS_URL && pgStore) {
    redisClient = new Redis(process.env.REDIS_URL);
    const redisStore = createRedisStore({
      redis: redisClient,
      keyPrefix: `wa:${instanceName.replace(/[^a-zA-Z0-9_]/g, '_')}:`
    });
    storeBackend = { pg: pgStore, redis: redisStore };
    providersConfig = { ...providersConfig, auth: 'redis', signal: 'redis' };
  }

  const store = createStore({
    backends: pgStore ? storeBackend : { sqlite: storeBackend },
    providers: providersConfig
  });

  return { store, pgStore, redisClient, poller };
}

function buildProxy(cfg: any): Record<string, any> | undefined {
  if (!cfg?.enabled || !cfg.host || !cfg.port) return undefined;

  const protocol = (cfg.protocol as string) || 'http';

  // Compose username with optional routing suffixes: username-[country]-[session]
  // country → targets a specific country in backconnect pools (2-letter ISO)
  // session → sticky session ID so the same IP is reused across reconnections
  //           (critical for WhatsApp: IP rotation mid-session triggers security checks)
  let effectiveUser: string = cfg.username || '';
  if (effectiveUser) {
    if (cfg.country) effectiveUser += `-${(cfg.country as string).toLowerCase()}`;
    if (cfg.session) effectiveUser += `-${cfg.session}`;
  }

  const auth = effectiveUser && cfg.password
    ? `${encodeURIComponent(effectiveUser)}:${encodeURIComponent(cfg.password)}@`
    : effectiveUser && !cfg.password
    ? `${encodeURIComponent(effectiveUser)}@` // passwordless (server IP pre-authorized)
    : '';

  const url = `${protocol}://${auth}${cfg.host}:${cfg.port}`;

  if (protocol === 'socks4' || protocol === 'socks5') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const agent = new SocksProxyAgent(url);
    return { ws: agent, mediaUpload: agent, mediaDownload: agent, linkPreview: agent };
  }

  // http / https — ws leg needs an http.Agent; media/linkPreview need an undici dispatcher
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const dispatcher = new ProxyAgent(url);
  const wsAgent = new HttpsProxyAgent(url);
  return { ws: wsAgent, mediaUpload: dispatcher, mediaDownload: dispatcher, linkPreview: dispatcher };
}

export class ZapoManager {
  // ── Socket.io bridge ────────────────────────────────────────────────────────

  static setSocketEmitter(fn: (event: string, payload: any) => void) {
    _socketEmitter = fn;
  }

  // ── In-memory chat/message accessors ────────────────────────────────────────

  // FIX 2: lê wa_chats do banco (sobrevive a restarts); overlay com Map em memória.
  // Retorna promessa — chamador na rota já era async.
  static async getChatList(instanceName: string): Promise<any[]> {
    const dbRows = await prisma.chatEntry.findMany({
      where: { instanceName },
      orderBy: { updatedAt: 'desc' },
    }).catch(() => []);

    // Constrói mapa a partir do banco
    const map = new Map<string, any>();
    for (const row of dbRows) {
      map.set(row.remoteJid, {
        id: row.remoteJid,
        remoteJid: row.remoteJid,
        pushName: row.pushName,
        profilePicUrl: row.profilePicUrl,
        labels: row.labels,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        instanceId: instanceName,
      });
    }

    // Overlay: entradas em memória (mais recentes) sobrescrevem o banco
    const byJid = chatList.get(instanceName);
    if (byJid) {
      for (const [jid, entry] of byJid.entries()) {
        map.set(jid, entry);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  static getMessageList(instanceName: string, remoteJid: string): any[] {
    const byJid = chatMessages.get(instanceName);
    return byJid?.get(remoteJid) ?? [];
  }

  public static recordSentMessage(instanceName: string, msgData: any) {
    this.storeMessage(instanceName, msgData);
  }

  private static storeMessage(instanceName: string, msgData: any) {
    const remoteJid: string = msgData.key?.remoteJid;
    if (!remoteJid) return;

    // Detect message type from proto structure
    const msgObj = msgData.message ?? {};
    const messageType = Object.keys(msgObj)[0] ?? 'unknown';

    const normalized = {
      id: msgData.key?.id ?? `${Date.now()}`,
      key: msgData.key,
      pushName: msgData.pushName ?? '',
      messageType,
      message: msgObj,
      messageTimestamp: String(msgData.messageTimestamp ?? Math.floor(Date.now() / 1000)),
      instanceId: instanceName,
      source: 'baileys',
    };

    if (!chatMessages.has(instanceName)) chatMessages.set(instanceName, new Map());
    const byJid = chatMessages.get(instanceName)!;
    const msgs = byJid.get(remoteJid) ?? [];
    // Deduplicate by message id
    if (!msgs.find((m: any) => m.id === normalized.id)) {
      msgs.push(normalized);
      byJid.set(remoteJid, msgs);
    }

    // Update in-memory chat entry (L1 cache)
    if (!chatList.has(instanceName)) chatList.set(instanceName, new Map());
    const byChat = chatList.get(instanceName)!;
    const existing = byChat.get(remoteJid) ?? {};
    const chatEntry = {
      id: remoteJid,
      pushName: msgData.pushName ?? existing.pushName ?? '',
      remoteJid,
      labels: existing.labels ?? null,
      profilePicUrl: existing.profilePicUrl ?? '',
      createdAt: existing.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      instanceId: instanceName,
    };
    byChat.set(remoteJid, chatEntry);

    // FIX 2: Persiste chat no banco (wa_chats) — fire-and-forget para não bloquear evento
    prisma.chatEntry.upsert({
      where: { instanceName_remoteJid: { instanceName, remoteJid } },
      create: {
        instanceName,
        remoteJid,
        pushName: chatEntry.pushName,
        profilePicUrl: chatEntry.profilePicUrl,
        labels: chatEntry.labels,
      },
      update: {
        pushName: chatEntry.pushName,
        profilePicUrl: chatEntry.profilePicUrl,
        updatedAt: new Date(),
      },
    }).catch((err: any) => {
      console.error(`[ZapoManager] [${instanceName}] Erro ao persistir chat ${remoteJid}:`, err.message);
    });
  }

  static async loadAll() {
    console.log(`[ZapoManager] Inicializando com CONTAINER_ID: ${CONTAINER_ID}`);
    const instances = await prisma.instance.findMany({
      where: { status: { in: ['connected', 'connecting'] } }
    });
    console.log(`[ZapoManager] Encontradas ${instances.length} instâncias para iniciar automaticamente.`);

    // Em ambiente sem Redis (dev local), locks ficam presos após kill abrupto do processo.
    // Força liberação de todos os locks antes de tentar conectar.
    if (!redisLockClient) {
      // sem Redis: acquireLock sempre retorna true — nenhuma ação necessária
    } else {
      await Promise.allSettled(
        instances.map(inst => releaseLock(inst.instanceName, CONTAINER_ID).catch(() => {}))
      );
      // Libera locks de qualquer container anterior (sobreposição do CONTAINER_ID não importa:
      // releaseLock só deleta se o valor bater — se não bater, o TTL de 30s vai expirar)
      // Para restart de dev, aguarda o TTL expirar ou usa DEL direto
      const staleKeys = await Promise.allSettled(
        instances.map(async inst => {
          const lockKey = `lock:zapo:${inst.instanceName}`;
          const holder = await redisLockClient.get(lockKey);
          if (holder && holder !== CONTAINER_ID) {
            console.log(`[ZapoManager] Limpando lock stale de ${inst.instanceName} (holder: ${holder})`);
            await redisLockClient.del(lockKey);
          }
        })
      );
      void staleKeys; // resultado ignorado intencionalmente
    }
    const results = await Promise.allSettled(
      instances.map(inst => this.connectClient(inst.instanceName))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[ZapoManager] Falha ao iniciar auto-conexão da instância ${instances[i].instanceName}:`, r.reason?.message);
      }
    });
  }

  static getActive(instanceName: string) {
    return activeClients.get(instanceName);
  }

  static getMessageStatus(instanceName: string, messageId: string) {
    const active = activeClients.get(instanceName);
    return active?.messageStatus?.get(messageId) || null;
  }

  static async createClient(instanceName: string, mobileTransport = false, deviceInfo?: any, customApiKey?: string) {
    let instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) {
      const apiKey = customApiKey || 'apikey_' + randomBytes(32).toString('hex');
      instance = await prisma.instance.create({
        data: { instanceName, apiKey, status: 'disconnected', mobileTransport, deviceInfo: deviceInfo || null }
      });
    }
    return instance;
  }

  static async connectClient(instanceName: string) {
    if (activeClients.has(instanceName)) {
      return activeClients.get(instanceName);
    }

    const gotLock = await acquireLock(instanceName, CONTAINER_ID);
    if (!gotLock) {
      console.warn(`[ZapoManager] [${instanceName}] Conexão negada: Outro container possui o lock de execução.`);
      throw new Error('Sessão ativa em outra réplica');
    }

    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) {
      await releaseLock(instanceName, CONTAINER_ID);
      throw new Error(`Instância ${instanceName} não cadastrada.`);
    }

    const settings = (instance.settingsConfig as any) ?? {};
    const rawProxy = (instance.proxyConfig as any) ?? {};
    // Auto-inject sticky session per instance when not explicitly set.
    // Prevents IP rotation between reconnections — WhatsApp treats mid-session
    // IP changes as suspicious and may trigger security challenges.
    const proxyConfig = rawProxy.enabled && rawProxy.username && !rawProxy.session
      ? { ...rawProxy, session: instanceName }
      : rawProxy;
    const logger = new ConsoleLogger('info');
    const { store, pgStore, redisClient, poller } = await buildStore(instanceName);
    const proxy = buildProxy(proxyConfig);

    if (proxy) {
      console.log(`[ZapoManager] [${instanceName}] Proxy ativo: ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`);
    }

    const clientOptions: any = {
      store,
      sessionId: instanceName,
      recoverFromClientTooOld: true,
      markOnlineOnConnect: settings.alwaysOnline ?? false,
      history: {
        enabled: process.env.SAVE_DATA_HISTORIC === 'true'
          || settings.syncFullHistory
          || false
      },
      deviceBrowser: process.env.SESSION_DEVICE_BROWSER || 'chrome',
      ...(process.env.SESSION_DEVICE_OS && { deviceOsDisplayName: process.env.SESSION_DEVICE_OS }),
      ...(proxy && { proxy }),
    };

    if (instance.mobileTransport) {
      clientOptions.mobileTransport = {
        deviceInfo: instance.deviceInfo || getMobileDevice()
      };
    }

    const client = new WaClient(clientOptions, logger);
    const activeData = {
      client, pgStore, redisClient, poller,
      qrCode: undefined as string | undefined,
      lockInterval: undefined as any,
      messageStatus: new Map<string, any>()
    };

    activeData.lockInterval = setInterval(async () => {
      const renewed = await renewLock(instanceName, CONTAINER_ID);
      if (!renewed) {
        console.error(`[ZapoManager] [${instanceName}] Perda do Lock de concorrência! Desconectando.`);
        await ZapoManager.disconnectClient(instanceName);
      }
    }, LOCK_RENEW);

    activeClients.set(instanceName, activeData);

    // ── Auth & Connection ─────────────────────────────────────────────────────

    client.on('auth_qr', async ({ qr }) => {
      console.log(`[ZapoManager] [${instanceName}] QR Code recebido.`);
      activeData.qrCode = qr;
      await prisma.instance.update({ where: { instanceName }, data: { status: 'connecting' } });
      ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connecting', qr });
    });

    client.on('auth_paired', async ({ credentials }) => {
      console.log(`[ZapoManager] [${instanceName}] Dispositivo pareado como ${credentials.meJid}`);
      activeData.qrCode = undefined;
      await prisma.instance.update({ where: { instanceName }, data: { status: 'connected' } });
      ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connected', meJid: credentials.meJid });
    });

    client.on('connection', async (event) => {
      console.log(`[ZapoManager] [${instanceName}] Evento de conexão:`, event);
      if (event.status === 'open') {
        const isRegistered = client.getState().registered;
        if (isRegistered) {
          activeData.qrCode = undefined;
          await prisma.instance.update({ where: { instanceName }, data: { status: 'connected' } });
          ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connected' });

          // Buscar foto e nome do perfil próprio de forma assíncrona (fire-and-forget)
          // Não bloquear o evento de conexão
          setImmediate(async () => {
            try {
              const meJid = client.getCredentials()?.meJid;
              if (!meJid) return;

              // Buscar foto de perfil
              let profilePicUrl = '';
              try {
                const pic = await client.profile.getProfilePicture(meJid);
                profilePicUrl = pic?.url ?? '';
              } catch (_) { /* privacidade: foto não acessível */ }

              // Buscar pushName — verificar onde está disponível:
              const creds = client.getCredentials() as any;
              const profileName = creds?.pushName ?? creds?.me?.name ?? '';

              await prisma.instance.update({
                where: { instanceName },
                data: { profilePicUrl, profileName, ownerJid: meJid }
              });

              // Emitir atualização ao frontend via socket
              _socketEmitter?.('connection.update', {
                instance: instanceName,
                data: { status: 'connected', profilePicUrl, profileName, ownerJid: meJid }
              });
            } catch (err: any) {
              console.warn(`[ZapoManager] [${instanceName}] Falha ao buscar perfil:`, err.message);
            }
          });
        } else {
          console.log(`[ZapoManager] [${instanceName}] Conexão de rede aberta, aguardando autenticação (registered=false).`);
        }
      } else if (event.status === 'close') {
        activeData.qrCode = undefined;
        const isLogout = (event as any).isLogout || (event as any).reason === 'stream_error_device_removed';
        if (isLogout) {
          console.log(`[ZapoManager] [${instanceName}] Desconexão permanente (logout/device_removed). Limpando recursos.`);
          ZapoManager.disconnectClient(instanceName).catch(err => {
            console.error(`[ZapoManager] [${instanceName}] Erro ao desconectar no evento de close:`, err.message);
          });
        } else {
          await prisma.instance.update({ where: { instanceName }, data: { status: 'disconnected' } });
          ZapoManager.sendWebhook(instanceName, 'connection.update', {
            status: 'disconnected',
            reason: (event as any).reason
          });
        }
      }
    });

    // ── Messages ──────────────────────────────────────────────────────────────

    client.on('message', async (event) => {
      if (settings.groupsIgnore && event.key.isGroup) return;
      if (settings.readMessages && !event.key.fromMe) {
        await client.message.sendReceipt(event, { type: 'read' }).catch(() => {});
      }
      const msgData = {
        key: event.key,
        message: event.message,
        messageTimestamp: event.timestampSeconds,
        pushName: event.pushName
      };
      ZapoManager.storeMessage(instanceName, msgData);
      const webhookPayload = { instance: instanceName, data: msgData };
      ZapoManager.sendWebhook(instanceName, 'messages.upsert', webhookPayload);
      _socketEmitter?.('messages.upsert', webhookPayload);
    });

    client.on('message_addon', (event) => {
      ZapoManager.sendWebhook(instanceName, 'messages.upsert', {
        instance: instanceName,
        data: { type: 'addon', addon: event }
      });
    });

    // ── Receipts (zapo-js native — WaIncomingReceiptEvent) ───────────────────

    client.on('receipt', (event) => {
      for (const messageId of event.messageIds) {
        const previous = activeData.messageStatus?.get(messageId) ?? {};
        activeData.messageStatus?.set(messageId, {
          ...previous,
          messageId,
          remoteJid: event.chatJid,
          status: event.status,
          updatedAt: new Date().toISOString()
        });
      }
      const updatePayload = { instance: instanceName, data: { chatJid: event.chatJid, status: event.status, messageIds: event.messageIds } };
      ZapoManager.sendWebhook(instanceName, 'messages.update', updatePayload);
      _socketEmitter?.('messages.update', updatePayload);
    });

    // ── Presence & Chat-state ─────────────────────────────────────────────────

    client.on('presence', (event) => {
      ZapoManager.sendWebhook(instanceName, 'presence.update', { instance: instanceName, data: event });
    });

    client.on('chatstate', (event) => {
      ZapoManager.sendWebhook(instanceName, 'chats.update', { instance: instanceName, data: event });
    });

    client.on('call', (event) => {
      ZapoManager.sendWebhook(instanceName, 'call', { instance: instanceName, data: event });
    });

    // ── Groups ────────────────────────────────────────────────────────────────

    client.on('group', (event) => {
      ZapoManager.sendWebhook(instanceName, 'groups.update', { instance: instanceName, data: event });
    });

    try {
      await client.connect();
    } catch (err) {
      await ZapoManager.disconnectClient(instanceName);
      throw err;
    }

    return activeData;
  }

  static async disconnectClient(instanceName: string) {
    const data = activeClients.get(instanceName);
    if (data) {
      if (data.lockInterval) clearInterval(data.lockInterval);
      try { await data.client.disconnect(); } catch (e) {}
      if (data.poller) data.poller.stop();
      if (data.redisClient) { try { await data.redisClient.quit(); } catch (e) {} }
      if (data.pgStore) { try { await data.pgStore.destroy(); } catch (e) {} }
      activeClients.delete(instanceName);
    }
    await releaseLock(instanceName, CONTAINER_ID);
    await prisma.instance.update({ where: { instanceName }, data: { status: 'disconnected' } });
  }

  static async deleteClient(instanceName: string) {
    await this.disconnectClient(instanceName);
    await prisma.instance.delete({ where: { instanceName } });
  }

  static async saveCredentials(instanceName: string, credentials: any) {
    const { store, pgStore, redisClient } = await buildStore(instanceName);
    try {
      const session = store.session(instanceName);
      await session.auth.save(credentials);
      await session.destroy();
    } finally {
      if (redisClient) { try { await redisClient.quit(); } catch (e) {} }
      if (pgStore) { try { await pgStore.destroy(); } catch (e) {} }
      try { await store.destroy(); } catch (e) {}
    }
  }

  private static async sendWebhook(instanceName: string, event: string, payload: any) {
    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    const cfg = (instance?.webhookConfig as any) ?? {};

    if (!cfg.enabled || !cfg.url) return;
    if (cfg.events?.length > 0 && !cfg.events.includes(event)) return;

    console.log(`[ZapoWebhook] [${instanceName}] → ${event}`);

    // FIX 4: 3 tentativas com backoff exponencial (1s, 2s, 4s)
    const MAX_ATTEMPTS = 3;
    const attempt = async (n: number): Promise<void> => {
      try {
        await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': instanceName },
          body: JSON.stringify({ event, instance: instanceName, payload })
        });
      } catch (err: any) {
        if (n < MAX_ATTEMPTS) {
          const delayMs = 1000 * Math.pow(2, n - 1); // 1s, 2s, 4s
          console.warn(`[ZapoWebhook] [${instanceName}] [${event}] tentativa ${n}/${MAX_ATTEMPTS} falhou — retry em ${delayMs}ms: ${err.message}`);
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
          return attempt(n + 1);
        }
        console.error(`[ZapoWebhook] Erro definitivo ao disparar [${event}] para ${cfg.url} após ${MAX_ATTEMPTS} tentativas:`, err.message);
      }
    };

    await attempt(1);
  }
}

