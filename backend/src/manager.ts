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

async function buildStore(
  instanceName: string,
  opts: { syncFullHistory?: boolean } = {}
): Promise<{ store: any; pgStore: any; redisClient: any; poller: any }> {
  let pgStore: any = null;
  let redisClient: any = null;
  let poller: any = null;
  let storeBackend: any;

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log(`[ZapoManager] [${instanceName}] [buildStore] Inicializando persistência no PostgreSQL...`);
    const pool = new Pool({ connectionString: dbUrl });

    // Test database connection
    try {
      const dbCheckClient = await pool.connect();
      console.log(`[ZapoManager] [${instanceName}] [buildStore] ✅ Conexão com o PostgreSQL estabelecida com sucesso.`);
      dbCheckClient.release();
    } catch (err: any) {
      console.error(`[ZapoManager] [${instanceName}] [buildStore] ❌ Falha de conexão com o PostgreSQL:`, err.message);
    }

    pgStore = createPostgresStore({
      pool,
      tablePrefix: 'wa_'
    });
    poller = pgStore.startCleanup(instanceName);
    storeBackend = pgStore;
  } else {
    const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
    console.log(`[ZapoManager] [${instanceName}] [buildStore] DATABASE_URL não definida. Inicializando persistência local em SQLite: ${sqlitePath}`);
    const dir = path.dirname(sqlitePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    storeBackend = createSqliteStore({ path: sqlitePath });
  }

  const saveMessages = process.env.SAVE_DATA_NEW_MESSAGE === 'true';
  const saveContacts = process.env.SAVE_DATA_CONTACTS === 'true';
  // syncFullHistory forces messages + threads providers so the zapo-js write-behind
  // persists historical blobs in the store backend (PostgreSQL/SQLite) instead of discarding them.
  const persistHistory = opts.syncFullHistory || (process.env.SAVE_DATA_HISTORIC === 'true');

  let providersConfig: any = {
    auth: pgStore ? 'pg' : 'sqlite',
    signal: pgStore ? 'pg' : 'sqlite',
    preKey: pgStore ? 'pg' : 'sqlite',
    session: pgStore ? 'pg' : 'sqlite',
    identity: pgStore ? 'pg' : 'sqlite',
    senderKey: pgStore ? 'pg' : 'sqlite',
    appState: pgStore ? 'pg' : 'sqlite',
    privacyToken: pgStore ? 'pg' : 'sqlite',
    messages: (saveMessages || persistHistory) && pgStore ? 'pg' : 'none',
    // threads: enabled when syncFullHistory so chat list is persisted in zapo store
    threads: persistHistory && pgStore ? 'pg' : 'none',
    contacts: saveContacts ? (pgStore ? 'pg' : 'sqlite') : 'none'
  };

  if (process.env.REDIS_URL && pgStore) {
    console.log(`[ZapoManager] [${instanceName}] [buildStore] Inicializando persistência no Redis: ${process.env.REDIS_URL}`);
    redisClient = new Redis(process.env.REDIS_URL);

    redisClient.on('connect', () => {
      console.log(`[ZapoManager] [${instanceName}] [buildStore] ✅ Conexão com o Redis estabelecida com sucesso.`);
    });
    redisClient.on('error', (err: any) => {
      console.error(`[ZapoManager] [${instanceName}] [buildStore] ❌ Erro de conexão com o Redis:`, err.message);
    });

    const redisStore = createRedisStore({
      redis: redisClient,
      keyPrefix: `wa:${instanceName.replace(/[^a-zA-Z0-9_]/g, '_')}:`
    });
    storeBackend = { pg: pgStore, redis: redisStore };
    providersConfig = { ...providersConfig, auth: 'redis', signal: 'redis' };
  } else if (process.env.REDIS_URL) {
    console.warn(`[ZapoManager] [${instanceName}] [buildStore] REDIS_URL fornecido mas PostgreSQL (pgStore) não está ativo. Redis ignorado.`);
  }

  console.log(`[ZapoManager] [${instanceName}] [buildStore] Provedores de persistência configurados:`, JSON.stringify(providersConfig, null, 2));

  const store = createStore({
    backends: pgStore ? storeBackend : { sqlite: storeBackend },
    providers: providersConfig
  });

  return { store, pgStore, redisClient, poller };
}

export async function testProxyConnectivity(cfg: any): Promise<{
  connected: boolean;
  externalIp?: string;
  latencyMs: number;
  error?: string;
  details?: string;
}> {
  const CHECK_URL = 'https://api.ipify.org?format=json';
  const protocol = (cfg.protocol as string) || 'http';

  // Apply same username suffix logic as buildProxy in manager.ts
  let effectiveUser: string = cfg.username || '';
  if (effectiveUser) {
    if (cfg.country) effectiveUser += `-${(cfg.country as string).toLowerCase().replace(/[^a-z]/g, '')}`;
    if (cfg.session && cfg.session !== 'none' && cfg.session !== 'disabled') {
      effectiveUser += `-${(cfg.session as string).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }
  }
  const auth = effectiveUser && cfg.password
    ? `${encodeURIComponent(effectiveUser)}:${encodeURIComponent(cfg.password)}@`
    : effectiveUser && !cfg.password
    ? `${encodeURIComponent(effectiveUser)}@`
    : '';
  const proxyUrl = `${protocol}://${auth}${cfg.host}:${cfg.port}`;
  const start = Date.now();

  console.log(`[ProxyCheck] Iniciando teste de conectividade via ${protocol} proxy (${cfg.host}:${cfg.port}). Suffixes: country=${cfg.country || 'none'}, session=${cfg.session || 'none'}, effectiveUser=${effectiveUser}`);

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
      const latency = Date.now() - start;
      console.log(`[ProxyCheck] Conectado via SOCKS com sucesso. IP externo: ${json.ip}. Latência: ${latency}ms`);
      return { connected: true, externalIp: json.ip, latencyMs: latency };
    }

    // HTTP / HTTPS — undici ProxyAgent supports both
    const dispatcher = new ProxyAgent(proxyUrl);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetch: undiciFetch } = require('undici');
    const res = await (undiciFetch as typeof fetch)(CHECK_URL, { dispatcher } as any);
    const json = await res.json() as { ip: string };
    const latency = Date.now() - start;
    console.log(`[ProxyCheck] Conectado via HTTP/HTTPS com sucesso. IP externo: ${json.ip}. Latência: ${latency}ms`);
    return { connected: true, externalIp: json.ip, latencyMs: latency };
  } catch (err: any) {
    console.error(`[ProxyCheck] Error testing connectivity via ${protocol} proxy (${cfg.host}:${cfg.port}):`, err);
    if (err.cause) {
      console.error(`[ProxyCheck] Cause:`, err.cause);
    }

    const fullErrorStr = [
      err.message,
      err.cause?.message,
      err.cause?.cause?.message,
      String(err.cause),
      String(err.cause?.cause)
    ].filter(Boolean).join(' | ');

    let errDetails = err.cause ? (err.cause.message || String(err.cause)) : undefined;
    if (fullErrorStr.includes('402')) {
      errDetails = 'Status 402 (Payment Required) - Por favor, verifique sua conta de proxy (saldo, assinatura ou limite de dados excedido).';
    } else if (fullErrorStr.includes('407')) {
      errDetails = 'Status 407 (Proxy Authentication Required) - Usuário ou senha do proxy incorretos, ou formato de sessão inválido.';
    }

    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err.message,
      details: errDetails
    };
  }
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
    if (cfg.country) effectiveUser += `-${(cfg.country as string).toLowerCase().replace(/[^a-z]/g, '')}`;
    if (cfg.session && cfg.session !== 'none' && cfg.session !== 'disabled') {
      effectiveUser += `-${(cfg.session as string).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }
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
  static proxyStatusCache = new Map<string, { connected: boolean; error?: string; details?: string }>();

  // ── Socket.io bridge ────────────────────────────────────────────────────────

  static setSocketEmitter(fn: (event: string, payload: any) => void) {
    _socketEmitter = fn;
  }

  // ── In-memory chat/message accessors ────────────────────────────────────────

  static debugState(instanceName: string) {
    const chats = [...(chatList.get(instanceName)?.keys() ?? [])];
    const msgsByJid: Record<string, number> = {};
    for (const [jid, msgs] of chatMessages.get(instanceName)?.entries() ?? []) {
      msgsByJid[jid] = msgs.length;
    }
    return { chats, messages: msgsByJid, connected: activeClients.has(instanceName) };
  }

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

  static async getMessageList(instanceName: string, remoteJid: string): Promise<any[]> {
    const inMemory = chatMessages.get(instanceName)?.get(remoteJid) ?? [];

    if (process.env.SAVE_DATA_NEW_MESSAGE !== 'true') return inMemory;

    const dbRows = await prisma.message.findMany({
      where: { instanceName, remoteJid },
      orderBy: { messageTimestamp: 'asc' },
    });

    const map = new Map<string, any>();
    for (const r of dbRows) {
      map.set(r.messageId, {
        id: r.messageId,
        key: { remoteJid: r.remoteJid, fromMe: r.fromMe, id: r.messageId },
        pushName: r.pushName,
        messageType: r.messageType,
        message: r.message,
        messageTimestamp: r.messageTimestamp,
        instanceId: r.instanceName,
        source: r.source,
      });
    }
    for (const m of inMemory) map.set(m.id, m);

    return Array.from(map.values());
  }

  private static unwrapMessage(message: any): any {
    if (!message) return {};
    let msg = message;
    while (true) {
      const inner = msg.ephemeralMessage?.message ??
        msg.groupMentionedMessage?.message ??
        msg.botInvokeMessage?.message ??
        msg.deviceSentMessage?.message ??
        msg.viewOnceMessage?.message ??
        msg.viewOnceMessageV2?.message ??
        msg.documentWithCaptionMessage?.message;
      if (!inner) break;
      msg = inner;
    }
    return msg;
  }

  public static recordSentMessage(instanceName: string, msgData: any) {
    this.storeMessage(instanceName, msgData);
  }

  private static persistMessageIfEnabled(instanceName: string, normalized: any, remoteJid: string) {
    if (process.env.SAVE_DATA_NEW_MESSAGE !== 'true') return;

    console.log(`[ZapoManager] [${instanceName}] [DATABASE] Tentando salvar mensagem ${normalized.id} no banco para JID=${remoteJid}...`);
    prisma.message.createMany({
      data: [{
        instanceName,
        remoteJid,
        messageId: normalized.id,
        fromMe: normalized.key?.fromMe ?? false,
        pushName: normalized.pushName,
        messageType: normalized.messageType,
        message: normalized.message as any,
        messageTimestamp: normalized.messageTimestamp,
        source: normalized.source,
      }],
      skipDuplicates: true,
    }).then((result) => {
      if (result.count > 0) {
        console.log(`[ZapoManager] [${instanceName}] [DATABASE] ✅ Mensagem ${normalized.id} salva com sucesso.`);
      } else {
        console.log(`[ZapoManager] [${instanceName}] [DATABASE] ↷ Mensagem ${normalized.id} já existia; duplicate ignorado.`);
      }
    }).catch((err: any) => {
      console.error(`[ZapoManager] [${instanceName}] [DATABASE] ❌ Erro ao persistir mensagem ${normalized.id}:`, err.message);
    });
  }

  private static storeMessage(instanceName: string, msgData: any): any {
    // Mobile Transport sends @lid JIDs; prefer the @s.whatsapp.net alt when available
    // so messages are stored under the same JID the frontend uses for navigation.
    const rawJid: string = msgData.key?.remoteJid;
    const altJid: string | undefined = msgData.key?.remoteJidAlt;
    const remoteJid: string = (altJid && !altJid.endsWith('@lid')) ? altJid : (rawJid ?? '');
    if (!remoteJid) return;

    // Detect message type from proto structure — skip metadata-only fields that zapo-js
    // may serialize before the actual content field (e.g. messageContextInfo).
    const METADATA_FIELDS = new Set(['messageContextInfo', '$$unknownFieldCount', 'viewOnceMessageV2Extension', 'pinInChatMessage']);
    const msgObj = msgData.message ?? {};
    const unwrapped = this.unwrapMessage(msgObj);
    const messageType = Object.keys(unwrapped).find(k => !METADATA_FIELDS.has(k)) ?? 'unknown';

    // Safely sanitize the unwrapped message to strip any non-serializable properties (e.g. class methods, functions)
    let sanitizedMessage = {};
    try {
      sanitizedMessage = JSON.parse(JSON.stringify(unwrapped));
    } catch (e) {
      sanitizedMessage = unwrapped;
    }

    const normalized = {
      id: msgData.key?.id ?? `${Date.now()}`,
      key: msgData.key,
      pushName: msgData.pushName ?? '',
      messageType,
      message: sanitizedMessage,
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

    // Persiste chat no banco (wa_chats) — fire-and-forget
    console.log(`[ZapoManager] [${instanceName}] [DATABASE] Tentando salvar/atualizar chat no banco para JID=${remoteJid}...`);
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
    }).then(() => {
      console.log(`[ZapoManager] [${instanceName}] [DATABASE] ✅ Chat ${remoteJid} persistido com sucesso.`);
    }).catch((err: any) => {
      console.error(`[ZapoManager] [${instanceName}] [DATABASE] ❌ Erro ao persistir chat ${remoteJid}:`, err.message);
    });

    // Persiste mensagem no banco quando SAVE_DATA_NEW_MESSAGE=true — fire-and-forget
    this.persistMessageIfEnabled(instanceName, normalized, remoteJid);

    return normalized;
  }

  static async loadAll() {
    console.log(`[ZapoManager] Inicializando com CONTAINER_ID: ${CONTAINER_ID}`);
    const autoReconnectPaired = process.env.AUTO_RECONNECT_PAIRED === 'true';
    const whereClause: any = autoReconnectPaired
      ? {
          OR: [
            { status: { in: ['connected', 'connecting'] } },
            { ownerJid: { not: '' } }
          ]
        }
      : { status: { in: ['connected', 'connecting'] } };

    const instances = await prisma.instance.findMany({
      where: whereClause
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

  static async createClient(instanceName: string, mobileTransport = false, deviceInfo?: any, customApiKey?: string, requestId?: string) {
    const trace = requestId ? `requestId=${requestId} | ` : '';
    console.log(`[ZapoManager] [Create] ${trace}createClient start instanceName=${instanceName} mobileTransport=${mobileTransport}`);
    let instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) {
      const apiKey = customApiKey || 'apikey_' + randomBytes(32).toString('hex');
      instance = await prisma.instance.create({
        data: { instanceName, apiKey, status: 'disconnected', mobileTransport, deviceInfo: deviceInfo || null }
      });
      console.log(`[ZapoManager] [Create] ${trace}instance created with apiKey=${apiKey.slice(0, 12)}...`);
    } else {
      console.log(`[ZapoManager] [Create] ${trace}existing instance found status=${instance.status} mobileTransport=${instance.mobileTransport}`);
    }
    console.log(`[ZapoManager] [Create] ${trace}createClient end instanceName=${instanceName} id=${instance.id}`);
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
    const { store, pgStore, redisClient, poller } = await buildStore(instanceName, { syncFullHistory: settings.syncFullHistory ?? false });
    const proxy = buildProxy(proxyConfig);
    if (proxy && instance.mobileTransport) {
      // mobileTransport uses TCP (port 5222) directly and doesn't use WebSockets.
      // We omit the 'ws' option to avoid the 'mobileTransport does not support socketOptions.proxy.ws' error,
      // but keep mediaUpload/mediaDownload/linkPreview proxy dispatchers active.
      delete proxy.ws;
    }

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
          || false,
        // requireFullSync: instructs the WhatsApp primary device to push the
        // full conversation history (not just RECENT) when enabled in settings.
        requireFullSync: settings.syncFullHistory ?? false,
      },
      deviceBrowser: process.env.SESSION_DEVICE_BROWSER || 'chrome',
      ...(process.env.SESSION_DEVICE_OS && { deviceOsDisplayName: process.env.SESSION_DEVICE_OS }),
      ...(proxy && { proxy }),
    };

    const hasCredentials = !!instance.ownerJid;
    if (instance.mobileTransport && hasCredentials) {
      clientOptions.mobileTransport = {
        deviceInfo: instance.deviceInfo || getMobileDevice()
      };
      console.log(`[ZapoManager] [${instanceName}] Inicializando cliente com Mobile Transport:`, JSON.stringify(clientOptions.mobileTransport, null, 2));
    } else if (instance.mobileTransport) {
      console.warn(`[ZapoManager] [${instanceName}] Instância Mobile sem credenciais registradas (ownerJid vazio). Ignorando mobileTransport para permitir pareamento QR Code via WebSocket.`);
    }

    const client = new WaClient(clientOptions, logger);
    const QR_LIMIT = parseInt(process.env.QRCODE_LIMIT ?? '5', 10);
    const activeData = {
      client, pgStore, redisClient, poller,
      qrCode: undefined as string | undefined,
      qrCount: 0,
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
      activeData.qrCount += 1;
      console.log(`[ZapoManager] [${instanceName}] QR Code recebido (${activeData.qrCount}/${QR_LIMIT}).`);

      if (activeData.qrCount > QR_LIMIT) {
        console.warn(`[ZapoManager] [${instanceName}] Limite de QR Codes atingido (${QR_LIMIT}). Encerrando tentativas.`);
        ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'disconnected', reason: 'qrcode_limit_reached' });
        _socketEmitter?.('connection.update', { instance: instanceName, data: { status: 'disconnected', reason: 'qrcode_limit_reached' } });
        // Desconecta sem marcar como logout — pode ser reconectado manualmente depois
        ZapoManager.disconnectClient(instanceName).catch((err: any) => {
          console.error(`[ZapoManager] [${instanceName}] Erro ao encerrar após limite de QR:`, err.message);
        });
        return;
      }

      activeData.qrCode = qr;
      await prisma.instance.update({ where: { instanceName }, data: { status: 'connecting' } });
      ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connecting', qr });
      _socketEmitter?.('connection.update', { instance: instanceName, data: { status: 'connecting', qr } });
    });

    client.on('auth_paired', async ({ credentials }) => {
      console.log(`[ZapoManager] [${instanceName}] Dispositivo pareado como ${credentials.meJid}`);
      activeData.qrCode = undefined;
      activeData.qrCount = 0;
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
              await ZapoManager.syncProfile(instanceName);
            } catch (err: any) {
              console.warn(`[ZapoManager] [${instanceName}] Falha ao buscar perfil na conexão:`, err.message);
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
          try {
            await prisma.instance.update({ where: { instanceName }, data: { status: 'disconnected' } });
          } catch (err: any) {
            console.log(`[ZapoManager] [${instanceName}] Falha ao definir status como desconectado (provavelmente excluída):`, err.message);
          }
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
      if (settings.readStatus && event.key.remoteJid === 'status@broadcast' && !event.key.fromMe) {
        await client.message.sendReceipt(event, { type: 'read' }).catch(() => {});
      }
      // Normalize @lid → @s.whatsapp.net so storage + socket payloads use the same JID
      // the frontend navigates by (phone number JID).
      const rawJid = event.key?.remoteJid ?? '';
      const altJid = event.key?.remoteJidAlt;
      const normalizedJid = (altJid && !altJid.endsWith('@lid')) ? altJid : rawJid;
      const normalizedKey = normalizedJid !== rawJid ? { ...event.key, remoteJid: normalizedJid } : event.key;
      const msgData = {
        key: normalizedKey,
        message: event.message,
        messageTimestamp: event.timestampSeconds,
        pushName: event.pushName
      };
      const normalized = ZapoManager.storeMessage(instanceName, msgData);
      const direction = event.key?.fromMe ? 'OUTBOUND/SENT' : 'INBOUND/RECEIVED';
      console.log(`[ZapoManager] [${instanceName}] [MESSAGE EVENT] [${direction}] jid=${normalizedJid} type=${normalized?.messageType} id=${event.key?.id} pushName=${event.pushName || 'N/A'} content=${JSON.stringify(event.message)}`);
      const webhookPayload = { instance: instanceName, data: normalized ?? msgData };
      ZapoManager.sendWebhook(instanceName, 'messages.upsert', webhookPayload);
      _socketEmitter?.('messages.upsert', webhookPayload);
    });

    client.on('message_addon', (event) => {
      console.log(`[ZapoManager] [${instanceName}] [MESSAGE ADDON EVENT] type=addon, fromMe=${event.key?.fromMe} jid=${event.key?.remoteJid} id=${event.key?.id} addonType=${(event as any).type || 'unknown'} content=${JSON.stringify(event)}`);
      ZapoManager.sendWebhook(instanceName, 'messages.upsert', {
        instance: instanceName,
        data: { type: 'addon', addon: event }
      });
    });

    // ── Receipts (zapo-js native — WaIncomingReceiptEvent) ───────────────────

    client.on('receipt', (event) => {
      console.log(`[ZapoManager] [${instanceName}] [MESSAGE STATUS/RECEIPT] chatJid=${event.chatJid} status=${event.status} messageIds=${JSON.stringify(event.messageIds)}`);
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

    client.on('call', async (event) => {
      ZapoManager.sendWebhook(instanceName, 'call', { instance: instanceName, data: event });

      if (settings.rejectCall && event.type === 'offer') {
        const toJid = event.callerPnJid ?? event.callCreatorJid;
        if (toJid) {
          await client.lowlevel.sendNode({
            tag: 'call',
            attrs: { to: toJid, id: Date.now().toString(16) },
            content: [{
              tag: 'reject',
              attrs: {
                'call-id': event.callId ?? '',
                'call-creator': event.callCreatorJid ?? '',
                'count': '0',
              },
            }],
          }).catch((err) => {
            console.error(`[ZapoManager] [${instanceName}] Falha ao rejeitar chamada:`, err.message);
          });

          if (settings.msgCall) {
            await client.message.send(toJid, settings.msgCall).catch((err) => {
              console.error(`[ZapoManager] [${instanceName}] Falha ao enviar mensagem de rejeição de chamada:`, err.message);
            });
          }
        }
      }
    });

    // ── Groups ────────────────────────────────────────────────────────────────

    client.on('group', (event) => {
      ZapoManager.sendWebhook(instanceName, 'groups.update', { instance: instanceName, data: event });
    });

    // ── History Sync ──────────────────────────────────────────────────────────
    // Fired once per chunk of history data pushed by the primary device.
    // The event contains ONLY metadata (counts + progress) — the actual messages
    // and threads are persisted internally by zapo-js via its write-behind store.
    // We use this event for terminal logging and to emit real-time progress to
    // the frontend via socket so the UI can display a sync indicator.

    if (settings.syncFullHistory) {
      client.on('history_sync_chunk', (event) => {
        const { syncType, messagesCount, conversationsCount, progress, chunkOrder } = event;
        console.log(
          `[ZapoManager] [${instanceName}] [HistorySync] chunk=${chunkOrder ?? '?'} ` +
          `progress=${progress != null ? progress + '%' : '?'} ` +
          `msgs=${messagesCount} convs=${conversationsCount} syncType=${syncType}`
        );
        const payload = {
          instance: instanceName,
          data: { syncType, messagesCount, conversationsCount, progress, chunkOrder }
        };
        ZapoManager.sendWebhook(instanceName, 'history.sync', payload);
        _socketEmitter?.('history.sync', payload);
      });
    }

    try {
      await client.connect();
      if (proxy) {
        ZapoManager.proxyStatusCache.set(instanceName, { connected: true });
      }
    } catch (err: any) {
      if (proxy) {
        // Run a real-time connectivity check to verify if the failure is actually due to the proxy
        const test = await testProxyConnectivity(proxyConfig).catch(() => ({ connected: false, error: 'Proxy check failed', details: undefined }));
        if (!test.connected) {
          ZapoManager.proxyStatusCache.set(instanceName, {
            connected: false,
            error: test.error || err.message,
            details: test.details
          });
        } else {
          // The proxy is working fine, so this error is related to credentials/registration (e.g. mobileTransport requires meJid)
          ZapoManager.proxyStatusCache.set(instanceName, { connected: true });
        }
      }
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

  static async syncProfile(instanceName: string): Promise<{ profilePicUrl: string; profileName: string; ownerJid: string } | null> {
    const active = activeClients.get(instanceName);
    if (!active) {
      console.warn(`[ZapoManager] [${instanceName}] Tentativa de sincronizar perfil mas a instância não está ativa.`);
      return null;
    }
    try {
      const meJid = active.client.getCredentials()?.meJid;
      if (!meJid) {
        console.warn(`[ZapoManager] [${instanceName}] JID do dispositivo conectado não encontrado nas credenciais.`);
        return null;
      }

      // Buscar foto de perfil
      let profilePicUrl = '';
      try {
        const pic = await active.client.profile.getProfilePicture(meJid);
        profilePicUrl = pic?.url ?? '';
      } catch (e: any) {
        console.log(`[ZapoManager] [${instanceName}] Não foi possível obter foto de perfil: ${e.message}`);
      }

      // Buscar pushName — meDisplayName é o campo correto em WaAuthCredentials (me.name não existe)
      const creds = active.client.getCredentials() as any;
      const profileName = creds?.pushName ?? creds?.meDisplayName ?? '';

      console.log(`[ZapoManager] [${instanceName}] Perfil sincronizado com sucesso: JID=${meJid}, Name="${profileName}", PicURL="${profilePicUrl}"`);

      // Só sobrescreve campos não-vazios — evita apagar valores existentes quando fetch falha (privacidade/400)
      await prisma.instance.update({
        where: { instanceName },
        data: {
          ownerJid: meJid,
          ...(profileName && { profileName }),
          ...(profilePicUrl && { profilePicUrl }),
        }
      });

      // Lê o estado atual para emitir valores reais (pode ter mantido os anteriores)
      const current = await prisma.instance.findUnique({
        where: { instanceName },
        select: { profileName: true, profilePicUrl: true }
      });

      // Emitir atualização ao frontend via socket
      _socketEmitter?.('connection.update', {
        instance: instanceName,
        data: { status: 'connected', profilePicUrl: current?.profilePicUrl ?? profilePicUrl, profileName: current?.profileName ?? profileName, ownerJid: meJid }
      });

      return { profilePicUrl: current?.profilePicUrl ?? profilePicUrl, profileName: current?.profileName ?? profileName, ownerJid: meJid };
    } catch (err: any) {
      console.error(`[ZapoManager] [${instanceName}] Erro ao sincronizar perfil:`, err.message);
      throw err;
    }
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
    // Normaliza para suportar tanto 'connection.update' quanto 'CONNECTION_UPDATE' armazenados
    const norm = (e: string) => e.toLowerCase().replace(/_/g, '.');
    if (cfg.events?.length > 0 && !cfg.events.some((e: string) => norm(e) === norm(event))) return;

    console.log(`[ZapoWebhook] [${instanceName}] → ${event}`);

    // FIX 4: 3 tentativas com backoff exponencial (1s, 2s, 4s)
    const MAX_ATTEMPTS = 3;
    const attempt = async (n: number): Promise<void> => {
      try {
        const response = await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': instanceName },
          body: JSON.stringify({ event, instance: instanceName, payload }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          throw new Error(`webhook http ${response.status}`);
        }
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
