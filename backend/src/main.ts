import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as net from 'net';
import { readFileSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { apiReference } from '@scalar/express-api-reference';
import instanceRouter from './routes/instance.routes';
import messageRouter from './routes/message.routes';
import chatRouter from './routes/chat.routes';
import contactRouter from './routes/contact.routes';
import configRouter from './routes/config.routes';
import { ZapoManager } from './manager';
import { fetchLatestAndroidWaVersion } from './config/fetchAndroidWaVersion';
import { fetchLatestIosWaVersion } from './config/fetchIosWaVersion';
import { setAppVersion, getCurrentAppVersion, setIosVersion, getCurrentIosVersion } from './config/device';

const execFileAsync = promisify(execFile);

function getZapoWebVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('zapo-js/spec/version').WA_VERSION ?? 'unknown';
  } catch { return 'unknown'; }
}

function getZapoLibVersion(): string {
  try {
    const zapoPkgPath = require.resolve('zapo-js/package.json');
    const pkg = JSON.parse(readFileSync(zapoPkgPath, 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('zapo-js/package.json').version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// Centraliza a leitura do arquivo .env buscando na pasta atual (backend) ou subindo para a raiz
const localEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '../.env');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 8080;

function checkPort(host: string, port: number, timeout = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições simples
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Rotas de API
app.use('/instance', instanceRouter);
app.use('/message', messageRouter);
app.use('/chat', chatRouter);
app.use('/contact', contactRouter);
app.use('/', configRouter);

// API docs interativa (Scalar)
const openapiSpec = readFileSync(path.join(__dirname, '../../docs/openapi.yaml'), 'utf8');
app.use('/api-docs', apiReference({ spec: { content: openapiSpec } }));

// Mock de licença da Evolution API v2 para evitar bloqueios na UI
app.get('/license/status', (req, res) => {
  res.json({ status: 'active' });
});
app.get('/license/register', (req, res) => {
  res.json({ status: 'active' });
});
app.get('/license/activate', (req, res) => {
  res.json({ status: 'active' });
});

// Rota GET / para verificação do servidor (retorna JSON para API, deixa passar HTML para o SPA)
app.get('/', (req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return next();
  }
  res.json({
    version: '2.0.0',
    clientName: 'zapo-manager',
    zapoVersion: getZapoLibVersion()
  });
});

// Rota POST /verify-creds para verificação da API Key global
app.post('/verify-creds', (req, res) => {
  const globalApiKey = process.env.GLOBAL_API_KEY;
  const requestKey = req.get('apikey');
  
  if (requestKey !== globalApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Global API Key' });
  }
  
  res.json({
    facebookAppId: null,
    facebookConfigId: null,
    facebookUserToken: null
  });
});

// Servir o Frontend Estático (Evolution Manager v2 compilado)
const publicPath = path.join(__dirname, 'public');
app.use('/', express.static(publicPath));

// Fallback do roteador SPA (React Router v7 / Vite)
// Redireciona qualquer rota que não seja de API para o index.html do frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/instance') || req.path.startsWith('/message')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      // Se a pasta public ou index.html não existirem ainda (em dev local sem build), envia mensagem
      res.status(200).send('<h1>Zapo-Manager Backend Running</h1><p>Frontend assets not found. Build the frontend first.</p>');
    }
  });
});

async function runMigrationsWithRetry(maxRetries = 5, delayMs = 3000) {
  const { prisma } = await import('./lib/prisma');
  const cwd = path.join(__dirname, '..');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Zapo-Manager] Aplicando migrations (Tentativa ${attempt}/${maxRetries})...`);
      await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], { cwd, shell: true });
      console.log('[Zapo-Manager] Migrations aplicadas com sucesso.');
      return;
    } catch (err: any) {
      let instanceTableExists = false;
      try {
        await prisma.$queryRawUnsafe('SELECT 1 FROM "Instance" LIMIT 1');
        instanceTableExists = true;
      } catch { /* banco inacessível ou tabela ausente */ }

      if (instanceTableExists) {
        console.warn('[Zapo-Manager] Tabela "Instance" existe sem histórico Prisma. Executando baselining automático...');
        try {
          await execFileAsync('npx', ['prisma', 'migrate', 'resolve', '--applied', '20260619000001_init'], { cwd, shell: true });
          await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], { cwd, shell: true });
          console.log('[Zapo-Manager] Migrations aplicadas com sucesso pós-baselining.');
          return;
        } catch (resolveErr: any) {
          console.error('[Zapo-Manager] Erro ao baselinar migração inicial:', resolveErr.message);
        }
      }

      if (attempt === maxRetries) {
        throw new Error(`Falha persistente ao aplicar migrations após ${maxRetries} tentativas: ${err.message}`);
      }
      console.warn(`[Zapo-Manager] Banco não pronto. Aguardando ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function startServer(app: express.Express, initialPort: number, maxAttempts = 10): Promise<{ server: HttpServer; io: SocketServer; port: number }> {
  return new Promise((resolve, reject) => {
    let currentPort = initialPort;
    let server: HttpServer;

    const tryListen = () => {
      server = new HttpServer(app);

      const allowedOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

      const io = new SocketServer(server, {
        cors: {
          origin: allowedOrigin,
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      });

      // Auth middleware: validate apikey from handshake, join per-instance room
      io.use(async (socket, next) => {
        try {
          const apikey = socket.handshake.auth?.apikey as string | undefined;
          const instanceName = socket.handshake.auth?.instanceName as string | undefined;
          const globalKey = process.env.GLOBAL_API_KEY;

          if (!apikey) return next(new Error('Missing apikey'));

          // Global key grants access to all instances
          if (apikey === globalKey) {
            if (instanceName) socket.data.instanceName = instanceName;
            return next();
          }

          // Instance-specific key: validate against DB
          if (!instanceName) return next(new Error('Missing instanceName'));
          const { prisma: db } = await import('./lib/prisma');
          const inst = await db.instance.findUnique({ where: { instanceName } });
          if (!inst || inst.apiKey !== apikey) return next(new Error('Unauthorized'));

          socket.data.instanceName = instanceName;
          next();
        } catch (err: any) {
          next(new Error(err.message));
        }
      });

      io.on('connection', (socket) => {
        const instanceName: string | undefined = socket.data.instanceName;
        if (instanceName) {
          socket.join(instanceName);
          console.log(`[Socket.io] ${socket.id} joined room: ${instanceName}`);
        }
        socket.on('disconnect', () => {
          console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
        });
      });

      server.listen(currentPort);

      server.on('listening', () => {
        resolve({ server, io, port: currentPort });
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Zapo-Manager] Porta ${currentPort} em uso. Tentando a próxima porta...`);
          io.close();
          server.close();
          currentPort++;
          if (currentPort >= initialPort + maxAttempts) {
            reject(new Error(`Nenhuma porta disponível no intervalo [${initialPort} - ${initialPort + maxAttempts - 1}]`));
          } else {
            tryListen();
          }
        } else {
          reject(err);
        }
      });
    };

    tryListen();
  });
}

async function autoRegisterServerIp() {
  const apiKey = process.env.PROXY_API_KEY;
  const authUrl = process.env.PROXY_IP_AUTH_URL;
  if (!apiKey || !authUrl) return;

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5_000),
    });
    const { ip } = await ipRes.json() as { ip: string };
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_address: ip }),
    });
    if (authRes.status === 201 || authRes.status === 200) {
      console.log(`[Zapo-Manager] IP ${ip} autorizado no provedor de proxies.`);
    } else if (authRes.status === 409) {
      console.log(`[Zapo-Manager] IP ${ip} já autorizado no provedor de proxies.`);
    } else {
      console.warn(`[Zapo-Manager] Aviso ao autorizar IP ${ip}: HTTP ${authRes.status}`);
    }
  } catch (err: any) {
    console.warn(`[Zapo-Manager] Falha ao auto-registrar IP no provedor de proxies: ${err.message}`);
  }
}

let _httpServer: HttpServer | null = null;

process.on('SIGTERM', () => {
  console.log('[Zapo-Manager] SIGTERM recebido. Encerrando sessões ativas...');
  if (_httpServer) _httpServer.close(() => process.exit(0));
  else process.exit(0);
});

async function bootstrap() {
  if (!process.env.GLOBAL_API_KEY) {
    console.error('[Zapo-Manager] FATAL: GLOBAL_API_KEY não definida. Configure a variável de ambiente antes de iniciar.');
    process.exit(1);
  }

  try {
    await runMigrationsWithRetry();

    console.log(`[Zapo-Manager] WA Web version (zapo-js built-in): ${getZapoWebVersion()}`);

    // Inicia verificação assíncrona de portas do WhatsApp para diagnóstico prévio
    setImmediate(async () => {
      const is5222Open = await checkPort('web.whatsapp.com', 5222);
      const is443Open = await checkPort('web.whatsapp.com', 443);
      if (!is5222Open) {
        console.warn('[Zapo-Manager] ⚠️ PORTA 5222 BLOQUEADA: Conexões nativas com o WhatsApp (Mobile Transport) podem falhar ou demorar para conectar.');
      } else {
        console.log('[Zapo-Manager] Port 5222 connectivity to web.whatsapp.com is OK.');
      }
      if (!is443Open) {
        console.warn('[Zapo-Manager] ⚠️ PORTA 443 BLOQUEADA: O servidor não consegue se conectar com o WhatsApp Web.');
      } else {
        console.log('[Zapo-Manager] Port 443 connectivity to web.whatsapp.com is OK.');
      }
    });

    const latestAndroidVersion = await fetchLatestAndroidWaVersion();
    if (latestAndroidVersion) {
      setAppVersion(latestAndroidVersion);
      console.log(`[Zapo-Manager] WA Business Android version (Play Store): ${latestAndroidVersion}`);
    } else {
      console.warn(`[Zapo-Manager] WA Business Android version: fetch falhou — usando fallback hardcoded: ${getCurrentAppVersion()}`);
    }

    const latestIosVersion = await fetchLatestIosWaVersion();
    if (latestIosVersion) {
      setIosVersion(latestIosVersion);
      console.log(`[Zapo-Manager] WA Business iOS version (App Store): ${latestIosVersion}`);
    } else {
      console.warn(`[Zapo-Manager] WA Business iOS version: fetch falhou — usando fallback hardcoded: ${getCurrentIosVersion()}`);
    }

    // Atualiza versão WA Business diariamente às 03:00 (horário do servidor)
    const scheduleDailyVersionCheck = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(3, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now.getTime();
      setTimeout(async () => {
        const [vAndroid, vIos] = await Promise.all([fetchLatestAndroidWaVersion(), fetchLatestIosWaVersion()]);
        if (vAndroid) {
          setAppVersion(vAndroid);
          console.log(`[Zapo-Manager] WA Business Android version atualizada (Play Store): ${vAndroid}`);
        } else {
          console.warn(`[Zapo-Manager] WA Business Android version: fetch diário falhou — mantendo: ${getCurrentAppVersion()}`);
        }
        if (vIos) {
          setIosVersion(vIos);
          console.log(`[Zapo-Manager] WA Business iOS version atualizada (App Store): ${vIos}`);
        } else {
          console.warn(`[Zapo-Manager] WA Business iOS version: fetch diário falhou — mantendo: ${getCurrentIosVersion()}`);
        }
        scheduleDailyVersionCheck();
      }, delay);
    };
    scheduleDailyVersionCheck();

    await autoRegisterServerIp();

    // FIX 1: Criar servidor e registrar setSocketEmitter ANTES de loadAll()
    // para que eventos 'connection.update' emitidos durante a reconexão das
    // instâncias (loadAll) sejam encaminhados ao frontend em tempo real.
    const startPort = typeof PORT === 'number' ? PORT : parseInt(PORT as string, 10) || 8080;
    const { server, io, port } = await startServer(app, startPort);
    _httpServer = server;

    // Wire Socket.io emitter — emit only to the room of the specific instance
    ZapoManager.setSocketEmitter((event, payload) => {
      const instanceName: string | undefined = payload?.instance;
      if (instanceName) {
        io.to(instanceName).emit(event, payload);
      } else {
        io.emit(event, payload); // fallback para eventos sem instanceName
      }
    });

    console.log(`[Zapo-Manager] Servidor rodando na porta ${port}`);
    console.log(`[Zapo-Manager] Acesse a API em: http://localhost:${port}`);

    // Iniciar reconexão das instâncias — emitter já está registrado
    await ZapoManager.loadAll();
  } catch (err: any) {
    console.error('[Zapo-Manager] Erro crítico no bootstrap:', err.message);
    process.exit(1);
  }
}

bootstrap();
