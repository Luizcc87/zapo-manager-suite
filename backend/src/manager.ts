import { createStore, WaClient, ConsoleLogger } from 'zapo-js';
import { getMobileDevice } from './config/device';
import { createPostgresStore } from '@zapo-js/store-postgres';
import { createRedisStore } from '@zapo-js/store-redis';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const activeClients = new Map<string, {
  client: WaClient;
  pgStore?: any;
  redisClient?: any;
  poller?: any;
  qrCode?: string;
  lockInterval?: NodeJS.Timeout;
  messageStatus?: Map<string, any>;
}>();

// Redis para Locks de Concorrência
const redisLockClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const LOCK_TIMEOUT = 30000; // 30s TTL
const LOCK_RENEW = 10000;   // 10s renovação

async function acquireLock(instanceName: string, containerId: string): Promise<boolean> {
  if (!redisLockClient) return true; // Sem redis, assume modo single-node
  const lockKey = `lock:zapo:${instanceName}`;
  const acquired = await redisLockClient.set(lockKey, containerId, 'PX', LOCK_TIMEOUT, 'NX');
  return acquired === 'OK';
}

async function renewLock(instanceName: string, containerId: string): Promise<boolean> {
  if (!redisLockClient) return true;
  const lockKey = `lock:zapo:${instanceName}`;
  // Script Lua para garantir que só renova se for o dono do lock
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

// Identificador único do container/processo
const CONTAINER_ID = process.env.HOSTNAME || Math.random().toString(36).substring(7);

export class ZapoManager {
  static async loadAll() {
    console.log(`[ZapoManager] Inicializando com CONTAINER_ID: ${CONTAINER_ID}`);
    const instances = await prisma.instance.findMany({
      where: {
        status: { in: ['connected', 'connecting'] }
      }
    });

    console.log(`[ZapoManager] Encontradas ${instances.length} instâncias para iniciar automaticamente.`);
    for (const inst of instances) {
      try {
        await this.connectClient(inst.instanceName);
      } catch (err: any) {
        console.error(`[ZapoManager] Falha ao iniciar auto-conexão da instância ${inst.instanceName}:`, err.message);
      }
    }
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
        data: {
          instanceName,
          apiKey,
          status: 'disconnected',
          mobileTransport,
          deviceInfo: deviceInfo || null
        }
      });
    }
    return instance;
  }

  static async connectClient(instanceName: string) {
    if (activeClients.has(instanceName)) {
      return activeClients.get(instanceName);
    }

    // Tentar obter o lock de concorrência antes de conectar (Docker Swarm Safety)
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

    const logger = new ConsoleLogger('info');
    let storeBackend: any;
    let redisClient: any = null;
    let pgStore: any = null;
    let poller: any = null;

    // Configuração dinâmica de Backends de Armazenamento
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      pgStore = createPostgresStore({
        pool: new Pool({ connectionString: dbUrl }),
        tablePrefix: 'wa_'
      });
      poller = pgStore.startCleanup(instanceName);
      storeBackend = pgStore;
    } else {
      // Fallback para SQLite em ambiente local/testes
      const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
      const dir = path.dirname(sqlitePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      storeBackend = createSqliteStore({ path: sqlitePath });
    }

    // Redis opcional para cache rápido de estado do sinal/sessões
    let providersConfig: any = {
      auth: pgStore ? 'pg' : 'sqlite',
      signal: pgStore ? 'pg' : 'sqlite',
      preKey: pgStore ? 'pg' : 'sqlite',
      session: pgStore ? 'pg' : 'sqlite',
      identity: pgStore ? 'pg' : 'sqlite',
      senderKey: pgStore ? 'pg' : 'sqlite',
      appState: pgStore ? 'pg' : 'sqlite',
      privacyToken: pgStore ? 'pg' : 'sqlite',
      messages: 'none',
      threads: 'none',
      contacts: 'none'
    };

    if (process.env.REDIS_URL && pgStore) {
      redisClient = new Redis(process.env.REDIS_URL);
      const redisStore = createRedisStore({
        redis: redisClient,
        keyPrefix: `wa:${instanceName.replace(/[^a-zA-Z0-9_]/g, '_')}:`
      });
      storeBackend = {
        pg: pgStore,
        redis: redisStore
      };
      providersConfig = {
        ...providersConfig,
        auth: 'redis',
        signal: 'redis'
      };
    }

    const store = createStore({
      backends: pgStore ? storeBackend : { sqlite: storeBackend },
      providers: providersConfig
    });

    const clientOptions: any = {
      store,
      sessionId: instanceName,
      // Auto-reconnect with latest WA Web version on failure_client_too_old (Web transport)
      recoverFromClientTooOld: true,
    };

    // Aplicar transporte Mobile (TCP Android) se configurado
    if (instance.mobileTransport) {
      clientOptions.mobileTransport = {
        // instance.deviceInfo persisted from registration; falls back to runtime-resolved version
        deviceInfo: instance.deviceInfo || getMobileDevice()
      };
    }

    const client = new WaClient(clientOptions, logger);
    const activeData = {
      client,
      pgStore,
      redisClient,
      poller,
      qrCode: undefined as string | undefined,
      lockInterval: undefined as any,
      messageStatus: new Map<string, any>()
    };

    // Iniciar loop de renovação do Lock de concorrência
    activeData.lockInterval = setInterval(async () => {
      const renewed = await renewLock(instanceName, CONTAINER_ID);
      if (!renewed) {
        console.error(`[ZapoManager] [${instanceName}] Perda do Lock de concorrência! Desconectando.`);
        await ZapoManager.disconnectClient(instanceName);
      }
    }, LOCK_RENEW);

    activeClients.set(instanceName, activeData);

    // Tratamento de Eventos
    client.on('auth_qr', async ({ qr }) => {
      console.log(`[ZapoManager] [${instanceName}] QR Code recebido.`);
      activeData.qrCode = qr;
      await prisma.instance.update({
        where: { instanceName },
        data: { status: 'connecting' }
      });
      ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connecting', qr });
    });

    client.on('auth_paired', async ({ credentials }) => {
      console.log(`[ZapoManager] [${instanceName}] Dispositivo pareado como ${credentials.meJid}`);
      activeData.qrCode = undefined;
      await prisma.instance.update({
        where: { instanceName },
        data: { status: 'connected' }
      });
      ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connected', meJid: credentials.meJid });
    });

    client.on('connection', async (event) => {
      console.log(`[ZapoManager] [${instanceName}] Evento de conexão:`, event);
      if (event.status === 'open') {
        activeData.qrCode = undefined;
        await prisma.instance.update({
          where: { instanceName },
          data: { status: 'connected' }
        });
        ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'connected' });
      } else if (event.status === 'close') {
        await prisma.instance.update({
          where: { instanceName },
          data: { status: 'disconnected' }
        });
        ZapoManager.sendWebhook(instanceName, 'connection.update', { status: 'disconnected' });
      }
    });

    // Encaminhar mensagens recebidas via Webhook
    client.on('message', async (event) => {
      // Normalização básica de mensagem para o formato esperado pelos fluxos
      ZapoManager.sendWebhook(instanceName, 'messages.upsert', {
        instance: instanceName,
        data: {
          key: event.key,
          message: event.message,
          messageTimestamp: event.timestampSeconds,
          pushName: event.pushName
        }
      });
    });

    const eventEmitter = client as any;

    eventEmitter.ev.on('messages.update', (updates: any[]) => {
      for (const update of updates || []) {
        const messageId = update.key?.id;
        if (!messageId) continue;
        const previous = activeData.messageStatus?.get(messageId) || {};
        activeData.messageStatus?.set(messageId, {
          ...previous,
          messageId,
          remoteJid: update.key?.remoteJid,
          fromMe: update.key?.fromMe ?? previous.fromMe,
          status: update.update?.status ?? previous.status,
          update: update.update,
          updatedAt: new Date().toISOString()
        });
      }
    });

    eventEmitter.ev.on('message-receipt.update', (updates: any[]) => {
      for (const update of updates || []) {
        const messageId = update.key?.id;
        if (!messageId) continue;
        const previous = activeData.messageStatus?.get(messageId) || {};
        activeData.messageStatus?.set(messageId, {
          ...previous,
          messageId,
          remoteJid: update.key?.remoteJid,
          fromMe: update.key?.fromMe ?? previous.fromMe,
          status: update.receipt?.type ?? previous.status,
          receipt: update.receipt,
          updatedAt: new Date().toISOString()
        });
      }
    });

    // Tentar conectar de fato
    try {
      await client.connect();
    } catch (err) {
      // Se falhar a conexão, limpa recursos locais e libera lock
      await ZapoManager.disconnectClient(instanceName);
      throw err;
    }

    return activeData;
  }

  static async disconnectClient(instanceName: string) {
    const data = activeClients.get(instanceName);
    if (data) {
      if (data.lockInterval) clearInterval(data.lockInterval);
      try {
        await data.client.disconnect();
      } catch (e) {}

      if (data.poller) data.poller.stop();
      if (data.redisClient) {
        try {
          await data.redisClient.quit();
        } catch (e) {}
      }
      if (data.pgStore) {
        try {
          await data.pgStore.destroy();
        } catch (e) {}
      }

      activeClients.delete(instanceName);
    }
    await releaseLock(instanceName, CONTAINER_ID);
    
    await prisma.instance.update({
      where: { instanceName },
      data: { status: 'disconnected' }
    });
  }

  static async deleteClient(instanceName: string) {
    await this.disconnectClient(instanceName);
    await prisma.instance.delete({ where: { instanceName } });
  }

  static async saveCredentials(instanceName: string, credentials: any) {
    let pgStore: any = null;
    let redisClient: any = null;
    let storeBackend: any = null;

    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      pgStore = createPostgresStore({
        pool: new Pool({ connectionString: dbUrl }),
        tablePrefix: 'wa_'
      });
      storeBackend = pgStore;
    } else {
      const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
      const dir = path.dirname(sqlitePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      storeBackend = createSqliteStore({ path: sqlitePath });
    }

    let providersConfig: any = {
      auth: pgStore ? 'pg' : 'sqlite',
      signal: pgStore ? 'pg' : 'sqlite',
      preKey: pgStore ? 'pg' : 'sqlite',
      session: pgStore ? 'pg' : 'sqlite',
      identity: pgStore ? 'pg' : 'sqlite',
      senderKey: pgStore ? 'pg' : 'sqlite',
      appState: pgStore ? 'pg' : 'sqlite',
      privacyToken: pgStore ? 'pg' : 'sqlite',
      messages: 'none',
      threads: 'none',
      contacts: 'none'
    };

    if (process.env.REDIS_URL && pgStore) {
      redisClient = new Redis(process.env.REDIS_URL);
      const redisStore = createRedisStore({
        redis: redisClient,
        keyPrefix: `wa:${instanceName.replace(/[^a-zA-Z0-9_]/g, '_')}:`
      });
      storeBackend = {
        pg: pgStore,
        redis: redisStore
      };
      providersConfig = {
        ...providersConfig,
        auth: 'redis',
        signal: 'redis'
      };
    }

    const store = createStore({
      backends: pgStore ? storeBackend : { sqlite: storeBackend },
      providers: providersConfig
    });

    try {
      const session = store.session(instanceName);
      await session.auth.save(credentials);
      await session.destroy();
    } finally {
      if (redisClient) {
        try { await redisClient.quit(); } catch (e) {}
      }
      if (pgStore) {
        try { await pgStore.destroy(); } catch (e) {}
      }
      try { await store.destroy(); } catch (e) {}
    }
  }

  private static async sendWebhook(instanceName: string, event: string, payload: any) {
    // Busca URLs de webhook ativas para a instância
    // Por simplicidade, vamos simular ou buscar de uma config global.
    // Em um sistema real, leríamos as URLs configuradas na tabela wa_webhooks.
    console.log(`[ZapoWebhook] Dispatching event [${event}] para a instância ${instanceName}:`, JSON.stringify(payload).substring(0, 100) + '...');
    
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': instanceName
          },
          body: JSON.stringify({
            event,
            instance: instanceName,
            payload
          })
        });
      } catch (err: any) {
        console.error(`[ZapoWebhook] Erro ao disparar webhook para ${webhookUrl}:`, err.message);
      }
    }
  }
}
