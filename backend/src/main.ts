import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { Server } from 'http';
import instanceRouter from './routes/instance.routes';
import messageRouter from './routes/message.routes';
import { ZapoManager } from './manager';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições simples
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Rotas de API da Evolution
app.use('/instance', instanceRouter);
app.use('/message', messageRouter);

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
    clientName: 'zapo-manager'
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
  const prisma = new PrismaClient();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Zapo-Manager] Aplicando migrations (Tentativa ${attempt}/${maxRetries})...`);
      execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
      console.log('[Zapo-Manager] Migrations aplicadas com sucesso.');
      await prisma.$disconnect();
      return;
    } catch (err: any) {
      // Se der erro, verificamos se a tabela "Instance" já existe no banco de dados (Baselining automático se P3005 ocorrer)
      let instanceTableExists = false;
      try {
        await prisma.$queryRawUnsafe('SELECT 1 FROM "Instance" LIMIT 1');
        instanceTableExists = true;
      } catch (dbErr) {
        // Tabela não existe ou banco inacessível
      }

      if (instanceTableExists) {
        console.warn('[Zapo-Manager] A tabela "Instance" já existe, mas o histórico de migração do Prisma está ausente. Executando baselining automático da migração inicial...');
        try {
          execFileSync('npx', ['prisma', 'migrate', 'resolve', '--applied', '20260619000001_init'], { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
          console.log('[Zapo-Manager] Migração inicial baselinada com sucesso. Re-executando deploy...');
          execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
          console.log('[Zapo-Manager] Migrations aplicadas com sucesso pós-baselining.');
          await prisma.$disconnect();
          return;
        } catch (resolveErr: any) {
          console.error('[Zapo-Manager] Erro ao tentar baselinar migração inicial:', resolveErr.message);
        }
      }

      if (attempt === maxRetries) {
        await prisma.$disconnect();
        throw new Error(`Falha persistente ao aplicar migrations após ${maxRetries} tentativas: ${err.message}`);
      }
      console.warn(`[Zapo-Manager] Banco de dados não está pronto ou erro na migração. Aguardando ${delayMs / 1000}s antes de tentar de novo...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  await prisma.$disconnect();
}

function startServer(app: express.Express, initialPort: number, maxAttempts = 10): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    let currentPort = initialPort;
    let server: Server;

    const tryListen = () => {
      server = app.listen(currentPort);

      server.on('listening', () => {
        resolve({ server, port: currentPort });
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Zapo-Manager] Porta ${currentPort} em uso. Tentando a próxima porta...`);
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

async function bootstrap() {
  if (!process.env.GLOBAL_API_KEY) {
    console.error('[Zapo-Manager] FATAL: GLOBAL_API_KEY não definida. Configure a variável de ambiente antes de iniciar.');
    process.exit(1);
  }

  try {
    // Aplica migrations com retry para aguardar o banco estar pronto
    await runMigrationsWithRetry();

    // Carregar e reconectar instâncias ativas do banco de dados na inicialização
    await ZapoManager.loadAll();
    
    const startPort = typeof PORT === 'number' ? PORT : parseInt(PORT as string, 10) || 8080;
    const { port } = await startServer(app, startPort);
    console.log(`[Zapo-Manager] Servidor rodando na porta ${port}`);
    console.log(`[Zapo-Manager] Acesse a UI em: http://localhost:${port}`);
  } catch (err: any) {
    console.error('[Zapo-Manager] Erro crítico no bootstrap:', err.message);
    process.exit(1);
  }
}

// Tratamento de sinais de terminação para encerramento limpo das conexões
process.on('SIGTERM', async () => {
  console.log('[Zapo-Manager] SIGTERM recebido. Encerrando sessões ativas...');
  // A classe ZapoManager cuida de liberar locks e fechar conexões
  process.exit(0);
});

bootstrap();
