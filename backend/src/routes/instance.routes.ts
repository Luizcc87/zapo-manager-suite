import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { getMobileDevice } from '../config/device';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { makeRegistrationSocket } from '@whiskeysockets/baileys/lib/Socket/registration.js';
import { DEFAULT_CONNECTION_CONFIG } from '@whiskeysockets/baileys/lib/Defaults/index.js';
import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '../lib/prisma';
import { checkGlobalApiKey, checkInstanceApiKey } from '../middleware/auth';

const router = Router();

const getWebVersion = () => {
  try {
    return require('zapo-js/spec/version').WA_VERSION ?? '';
  } catch (error) {
    return '';
  }
};

// Cache para sockets de registro com TTL de 10 minutos
interface RegistrationCacheItem {
  sock: any;
  phoneNumber: string;
}
const registrationSocketCache = new Map<string, RegistrationCacheItem>();

const setRegistrationCacheWithTTL = (key: string, value: RegistrationCacheItem) => {
  registrationSocketCache.set(key, value);
  setTimeout(() => {
    const item = registrationSocketCache.get(key);
    if (item) {
      console.log(`[ZapoRouter] [RegisterCode] Expired registration cache entry for ${key}`);
      try {
        item.sock.ev.removeAllListeners();
        item.sock.ws.close();
      } catch (e) {}
      registrationSocketCache.delete(key);
    }
  }, 10 * 60 * 1000); // 10 min
};

// Parser de telefone
function parsePhoneNumber(fullPhone: string) {
  const digits = fullPhone.replace(/\D/g, '');
  
  // List of 3-digit country codes
  const cc3 = ['379', '380', '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998'];
  
  // List of 2-digit country codes
  const cc2 = ['20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98'];

  let cc = '';
  let national = '';

  if (cc3.includes(digits.substring(0, 3))) {
    cc = digits.substring(0, 3);
    national = digits.substring(3);
  } else if (cc2.includes(digits.substring(0, 2))) {
    cc = digits.substring(0, 2);
    national = digits.substring(2);
  } else if (digits.startsWith('1') || digits.startsWith('7')) {
    cc = digits.substring(0, 1);
    national = digits.substring(1);
  } else {
    cc = digits.substring(0, 2);
    national = digits.substring(2);
  }

  return { cc, national, full: digits };
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
    if (!instance.mobileTransport) {
      ZapoManager.connectClient(instanceName).catch(err => {
        console.error(`[ZapoRouter] Falha na inicialização assíncrona de ${instanceName}:`, err.message);
      });
    }

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

// 1.1. Solicitar código de registro (SMS/Voz)
router.post('/register/requestCode', checkGlobalApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, phoneNumber, method } = req.body;
    if (!instanceName || !phoneNumber) {
      return res.status(400).json({ error: 'instanceName and phoneNumber are required' });
    }

    console.log(`[ZapoRouter] [RegisterCode] Solicitação de código para ${instanceName}: ${phoneNumber} via ${method || 'sms'}`);

    // Garante que qualquer cliente ativo anterior seja desconectado
    await ZapoManager.disconnectClient(instanceName);

    // Limpar cache anterior de registro para evitar vazamento
    const oldItem = registrationSocketCache.get(instanceName);
    if (oldItem) {
      try {
        oldItem.sock.ev.removeAllListeners();
        oldItem.sock.ws.close();
      } catch (e) {}
      registrationSocketCache.delete(instanceName);
    }

    // Configurar AuthState temporário em disco para essa instância durante o registro
    const tempAuthDir = path.join(process.cwd(), '.auth', `temp-reg-${instanceName}`);
    if (fs.existsSync(tempAuthDir)) {
      try {
        fs.rmSync(tempAuthDir, { recursive: true, force: true });
      } catch (e) {}
    }
    fs.mkdirSync(tempAuthDir, { recursive: true });

    const { state } = await useMultiFileAuthState(tempAuthDir);

    // Inicializar socket de registro Baileys v6
    const sock = makeRegistrationSocket({
      ...DEFAULT_CONNECTION_CONFIG,
      auth: state,
      mobile: true,
      logger: require('pino')({ level: 'silent' }), // Silencia o logger do baileys
    });

    // Parsar o número para extrair o código do país e o número nacional
    const parsed = parsePhoneNumber(phoneNumber);

    console.log(`[ZapoRouter] [RegisterCode] Formatado - DDI: ${parsed.cc}, Nacional: ${parsed.national}`);

    // Solicitar código via SMS ou Ligação de voz
    await sock.requestRegistrationCode({
      phoneNumber: parsed.full,
      phoneNumberCountryCode: parsed.cc,
      phoneNumberNationalNumber: parsed.national,
      phoneNumberMobileCountryCode: '000',
      phoneNumberMobileNetworkCode: '000',
      method: method || 'sms',
    });

    // Salvar no cache com TTL
    setRegistrationCacheWithTTL(instanceName, {
      sock,
      phoneNumber: parsed.full,
    });

    // Persistir telefone no DB — sobrevive a restarts do servidor
    await prisma.$executeRaw`UPDATE "Instance" SET "registeredPhone" = ${parsed.full} WHERE "instanceName" = ${instanceName}`;

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error(`[ZapoRouter] [RegisterCode] Erro ao solicitar código:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 1.2. Confirmar código de registro
router.post('/register/confirmCode', checkGlobalApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, code } = req.body;
    if (!instanceName || !code) {
      return res.status(400).json({ error: 'instanceName and code are required' });
    }

    console.log(`[ZapoRouter] [ConfirmCode] Confirmando código ${code} para ${instanceName}`);
    
    // 1. Recuperar sock do cache
    const cached = registrationSocketCache.get(instanceName);
    if (!cached) {
      return res.status(400).json({ error: 'Sessão de registro expirada ou não encontrada. Solicite o código novamente.' });
    }

    const { sock } = cached;

    // 2. Validar OTP com servidores do WhatsApp
    await sock.register(code);

    // 3. Log de mitigação: logar creds de Baileys e de Zapo (se houver outra instância) lado a lado
    let existingCredsFromZapo: any = null;
    try {
      const activeInstanceNames = await prisma.instance.findMany({
        select: { instanceName: true }
      });
      for (const inst of activeInstanceNames) {
        const active = ZapoManager.getActive(inst.instanceName);
        if (active) {
          existingCredsFromZapo = active.client.auth.getCurrentCredentials();
          if (existingCredsFromZapo) break;
        }
      }
    } catch (e: any) {
      console.log(`[ZapoRouter] [ConfirmCode] Erro ao buscar credenciais existentes de outra instância para o log de comparação:`, e.message);
    }

    console.log('[ZapoRouter] [ConfirmCode] === COMPARATIVO DE CREDENCIAIS ===');
    console.log('Baileys credentials:', JSON.stringify(sock.authState.creds, null, 2));
    console.log('Zapo credentials:', JSON.stringify(existingCredsFromZapo, null, 2));

    // 4. Mapear credenciais Baileys v6 para WaAuthCredentials do zapo-js
    const creds = sock.authState.creds;

    let advSecretKey: Uint8Array;
    if (typeof creds.advSecretKey === 'string') {
      advSecretKey = new Uint8Array(Buffer.from(creds.advSecretKey, 'base64'));
    } else if (creds.advSecretKey) {
      advSecretKey = new Uint8Array(creds.advSecretKey);
    } else {
      advSecretKey = new Uint8Array(32); // fallback
    }

    const mappedCreds: any = {
      noiseKeyPair: {
        pubKey: new Uint8Array(creds.noiseKey.public),
        privKey: new Uint8Array(creds.noiseKey.private)
      },
      registrationInfo: {
        registrationId: creds.registrationId,
        identityKeyPair: {
          pubKey: new Uint8Array(creds.signedIdentityKey.public),
          privKey: new Uint8Array(creds.signedIdentityKey.private)
        }
      },
      signedPreKey: {
        keyId: creds.signedPreKey.keyId,
        keyPair: {
          pubKey: new Uint8Array(creds.signedPreKey.keyPair.public),
          privKey: new Uint8Array(creds.signedPreKey.keyPair.private)
        },
        signature: new Uint8Array(creds.signedPreKey.signature)
      },
      advSecretKey,
      signedIdentity: creds.account || undefined,
      meJid: creds.me?.id,
      meLid: (creds.me as any)?.lid || undefined,
      meDisplayName: creds.me?.name || undefined,
      routingInfo: creds.routingInfo ? new Uint8Array(creds.routingInfo) : undefined,
      serverHasPreKeys: true,
      platform: 'android',
      deviceInfo: getMobileDevice()
    };

    console.log('[ZapoRouter] [ConfirmCode] Credenciais mapeadas para Zapo:', JSON.stringify(mappedCreds, null, 2));

    // 5. Salvar no mesmo store que o Zapo usa para sessões normais
    await ZapoManager.saveCredentials(instanceName, mappedCreds);

    // Desconecta qualquer cliente ativo anterior (garantia final)
    await ZapoManager.disconnectClient(instanceName);

    // 6. Atualizar status no banco de dados para "connected"
    await prisma.instance.update({
      where: { instanceName },
      data: { 
        status: 'connected',
        mobileTransport: true,
        deviceInfo: mappedCreds.deviceInfo
      }
    });

    // 7. Limpar cache de registro e deletar diretório temporário
    registrationSocketCache.delete(instanceName);
    const tempAuthDir = path.join(process.cwd(), '.auth', `temp-reg-${instanceName}`);
    if (fs.existsSync(tempAuthDir)) {
      try {
        fs.rmSync(tempAuthDir, { recursive: true, force: true });
      } catch (e) {}
    }

    // 8. Iniciar a conexão real da instância via ZapoManager em background
    ZapoManager.connectClient(instanceName).catch(err => {
      console.error(`[ZapoRouter] [ConfirmCode] Falha ao iniciar conexão real de Zapo para ${instanceName}:`, err.message);
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error(`[ZapoRouter] [ConfirmCode] Erro ao confirmar código:`, err.message);
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
      try {
        active = await ZapoManager.connectClient(instanceName);
      } catch (err: any) {
        console.warn(`[ZapoRouter] Falha ao iniciar cliente ${instanceName}:`, err.message);
        return res.status(200).json({
          code: '',
          count: 0,
          status: 'disconnected',
          error: err.message
        });
      }
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
    const clientState = active.client.getState();
    const connected = clientState.connected && clientState.registered;
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
      const isMockConnected = dbInstance?.status === 'connected';
      return res.status(200).json({
        instance: {
          instanceName,
          state: isMockConnected ? 'open' : 'close',
          status: dbInstance?.status || 'disconnected'
        }
      });
    }

    const clientState = active.client.getState();
    const connected = clientState.connected && clientState.registered;
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
    const { instanceId, instanceName } = req.query;
    console.log(`[ZapoRouter] GET /fetchInstances - query params:`, { instanceId, instanceName });
    const where = instanceId
      ? { id: instanceId as string }
      : instanceName
      ? { instanceName: instanceName as string }
      : undefined;
    const dbInstances = await prisma.instance.findMany({ where });
    console.log(`[ZapoRouter] GET /fetchInstances - found ${dbInstances.length} instances:`, dbInstances.map(i => i.instanceName));
    const result = dbInstances.map(inst => {
      const active = ZapoManager.getActive(inst.instanceName);
      const isMockConnected = inst.status === 'connected';
      const connected = !!active && active.client.getState().connected && active.client.getState().registered;
      const state = connected ? 'open' : (active?.qrCode ? 'connecting' : 'close');
      
      let ownerJid: string | null = null;
      if (active) {
        try {
          ownerJid = active.client.getCredentials()?.meJid || null;
        } catch (e) {}
      } else if (isMockConnected && inst.registeredPhone) {
        ownerJid = `${inst.registeredPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      }

      return {
        id: inst.id,
        name: inst.instanceName,
        connectionStatus: state,
        instanceType: inst.mobileTransport ? 'mobile' : 'web',
        mobileTransport: inst.mobileTransport,
        webhookEnabled: !!(inst.webhookConfig as any)?.enabled,
        softwareVersion: inst.mobileTransport
          ? ((inst.deviceInfo as any)?.appVersion || getMobileDevice().appVersion)
          : getWebVersion(),
        deviceInfo: inst.deviceInfo || (inst.mobileTransport ? getMobileDevice() : null),
        ownerJid: ownerJid || inst.ownerJid || null,
        profileName: inst.profileName || inst.instanceName,
        profilePicUrl: inst.profilePicUrl || '',
        integration: 'WHATSAPP-BAILEYS',
        number: isMockConnected ? (inst.registeredPhone || '') : '',
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
        proxyEnabled: !!(inst.proxyConfig as any)?.enabled,
        proxyConnected: ZapoManager.proxyStatusCache.get(inst.instanceName)?.connected ?? true,
        proxyError: ZapoManager.proxyStatusCache.get(inst.instanceName)?.connected === false 
          ? (ZapoManager.proxyStatusCache.get(inst.instanceName)?.details || ZapoManager.proxyStatusCache.get(inst.instanceName)?.error || null)
          : null,
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
