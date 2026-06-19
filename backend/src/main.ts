import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import instanceRouter from './routes/instance.routes';
import messageRouter from './routes/message.routes';
import { ZapoManager } from './manager';

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
  const globalApiKey = process.env.GLOBAL_API_KEY || 'global_key';
  const requestKey = req.get('apikey') || req.query.apikey as string;
  
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

async function bootstrap() {
  try {
    // Carregar e reconectar instâncias ativas do banco de dados na inicialização
    await ZapoManager.loadAll();
    
    app.listen(PORT, () => {
      console.log(`[Zapo-Manager] Servidor rodando na porta ${PORT}`);
      console.log(`[Zapo-Manager] Acesse a UI em: http://localhost:${PORT}`);
    });
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
