import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// Middleware de Autenticação Global da Evolution
// O Manager envia o Token global no header "apikey"
function checkGlobalApiKey(req: Request, res: Response, next: any) {
  const globalApiKey = process.env.GLOBAL_API_KEY;
  const requestKey = req.get('apikey');
  
  if (requestKey !== globalApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Global API Key' });
  }
  next();
}

// Middleware de Autenticação de Instância
// O Manager envia a chave específica da instância no header "apikey"
async function checkInstanceApiKey(req: Request, res: Response, next: any) {
  try {
    const { instanceName } = req.params;
    const requestKey = req.get('apikey');
    
    if (!instanceName) {
      return res.status(400).json({ error: 'instanceName parameter is required' });
    }

    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (instance.apiKey !== requestKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Instance API Key' });
    }

    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// 1. Criar Instância
router.post('/create', checkGlobalApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, mobileTransport, deviceInfo, token } = req.body;
    if (!instanceName) {
      return res.status(400).json({ error: 'instanceName is required' });
    }

    const instance = await ZapoManager.createClient(instanceName, mobileTransport || false, deviceInfo, token);
    
    // Inicia a conexão de forma assíncrona (gerar QR ou reconectar)
    ZapoManager.connectClient(instanceName).catch(err => {
      console.error(`[ZapoRouter] Falha na inicialização assíncrona de ${instanceName}:`, err.message);
    });

    return res.status(201).json({
      instance: {
        instanceName: instance.instanceName,
        instanceId: instance.id,
        status: instance.status,
        apikey: instance.apiKey
      },
      hash: {
        apikey: instance.apiKey
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Obter QR Code / Conectar
router.get('/connect/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    
    // Inicia a conexão se não estiver iniciada
    let active = ZapoManager.getActive(instanceName);
    if (!active) {
      active = await ZapoManager.connectClient(instanceName);
    }
    if (!active) {
      return res.status(500).json({ error: 'Failed to initialize active instance client' });
    }

    // Se tiver QR code em cache, retorna ele
    if (active.qrCode) {
      return res.status(200).json({
        code: active.qrCode,
        count: 0
      });
    }

    // Se já estiver conectado ou sem QR ainda
    const connected = active.client.getState().connected;
    return res.status(200).json({
      code: '',
      count: 0,
      status: connected ? 'connected' : 'disconnected'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Status da Conexão
router.get('/connectionState/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const active = ZapoManager.getActive(instanceName);
    
    if (!active) {
      const dbInstance = await prisma.instance.findUnique({ where: { instanceName } });
      return res.status(200).json({
        instance: {
          instanceName,
          state: 'close',
          status: dbInstance?.status || 'disconnected'
        }
      });
    }

    const connected = active.client.getState().connected;
    const state = connected ? 'open' : (active.qrCode ? 'connecting' : 'close');
    return res.status(200).json({
      instance: {
        instanceName,
        state: state,
        status: connected ? 'connected' : (active.qrCode ? 'connecting' : 'disconnected')
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Listar todas as Instâncias
router.get('/fetchInstances', checkGlobalApiKey, async (req: Request, res: Response) => {
  try {
    const dbInstances = await prisma.instance.findMany();
    const result = dbInstances.map(inst => {
      const active = ZapoManager.getActive(inst.instanceName);
      const connected = active ? active.client.getState().connected : false;
      const state = connected ? 'open' : (active?.qrCode ? 'connecting' : 'close');
      
      let ownerJid: string | null = null;
      if (active) {
        try {
          ownerJid = active.client.getCredentials()?.meJid || null;
        } catch (e) {}
      }

      return {
        id: inst.id,
        name: inst.instanceName,
        connectionStatus: state,
        ownerJid: ownerJid,
        profileName: inst.instanceName,
        profilePicUrl: '',
        integration: 'WHATSAPP-BAILEYS',
        number: '',
        businessId: '',
        token: inst.apiKey,
        clientName: 'evolution',
        createdAt: inst.createdAt.toISOString(),
        updatedAt: inst.updatedAt.toISOString(),
        Setting: {
          rejectCall: false,
          groupsIgnore: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        },
        _count: {
          Message: 0,
          Contact: 0,
          Chat: 0
        }
      };
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Desconectar / Logout
router.delete('/logout/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    await ZapoManager.disconnectClient(instanceName);
    return res.status(200).json({ status: 'success', message: 'Instance logged out' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Excluir Instância
router.delete('/delete/:instanceName', checkGlobalApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    await ZapoManager.deleteClient(instanceName);
    return res.status(200).json({ status: 'success', message: 'Instance deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
