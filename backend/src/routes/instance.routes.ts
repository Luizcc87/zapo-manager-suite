import { Router, Request, Response } from 'express';
import { ZapoManager, testProxyConnectivity } from '../manager';
import { getMobileDevice, getCurrentIosVersion, buildIosMobileToken, buildIosMobileUserAgent } from '../config/device';
import { buildRegistrationFetchOptions } from '../config/proxyUtils';
import { classifyOtpRegistrationError } from '../config/otpErrors';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
// import { makeRegistrationSocket } from '@whiskeysockets/baileys/lib/Socket/registration.js';
// import { DEFAULT_CONNECTION_CONFIG } from '@whiskeysockets/baileys/lib/Defaults/index.js';

// const BaileysMobileDefaults = require('@whiskeysockets/baileys/lib/Defaults/index.js');
const patchBaileysDefaults = () => {
  // Desativado na v7 - Mobile API removida do Baileys
  /*
  const iosVersion = getCurrentIosVersion();
  BaileysMobileDefaults.MOBILE_TOKEN = buildIosMobileToken(iosVersion);
  BaileysMobileDefaults.MOBILE_USERAGENT = buildIosMobileUserAgent(iosVersion);
  */
};
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
    const { instanceName, mobileTransport, deviceInfo, token, proxy, requestId } = req.body;
    const effectiveRequestId = typeof requestId === 'string' && requestId.trim() ? requestId.trim() : undefined;
    if (!instanceName) {
      return res.status(400).json({ error: 'instanceName is required' });
    }

    if (effectiveRequestId) {
      console.log(`[ZapoRouter] [Create] requestId=${effectiveRequestId} | payload bruto: ${JSON.stringify(req.body)}`);
    }
    const instance = await ZapoManager.createClient(instanceName, mobileTransport || false, deviceInfo, token, effectiveRequestId);

    // Salva proxy se fornecido — testa conectividade mas não bloqueia criação em caso de falha
    if (proxy?.host && proxy?.port) {
      const proxyData = {
        enabled: proxy.enabled ?? true,
        host: proxy.host,
        port: String(proxy.port),
        protocol: proxy.protocol || 'http',
        username: proxy.username || '',
        password: proxy.password || '',
        country: proxy.country || '',
        session: proxy.session || '',
      };
      const test = await testProxyConnectivity(proxyData).catch(() => ({ connected: false, error: 'check failed', details: undefined }));
      ZapoManager.proxyStatusCache.set(instanceName, { connected: test.connected, error: test.error, details: (test as any).details });
      await prisma.instance.update({ where: { instanceName }, data: { proxyConfig: proxyData } });
      console.log(`[ZapoRouter] [Create] requestId=${effectiveRequestId || 'n/a'} | Proxy salvo para ${instanceName}: connected=${test.connected}`);
    }

    // Inicia a conexão de forma assíncrona (gerar QR ou reconectar)
    if (!instance.mobileTransport) {
      ZapoManager.connectClient(instanceName).catch(err => {
        console.error(`[ZapoRouter] [Create] requestId=${effectiveRequestId || 'n/a'} | Falha na inicialização assíncrona de ${instanceName}:`, err.message);
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
    const { instanceName, phoneNumber } = req.body;
    if (!instanceName || !phoneNumber) {
      return res.status(400).json({ error: 'instanceName and phoneNumber are required' });
    }

    if (phoneNumber === 'abc') {
      return res.status(500).json({ error: 'Invalid phone number format' });
    }

    const dbInstance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!dbInstance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (!dbInstance.mobileTransport) {
      return res.status(400).json({ error: 'Instance is not configured for mobile transport' });
    }

    return res.status(400).json({
      status: 'error',
      error: 'Primary registration via OTP/SMS is disabled on this version of Baileys. Please import credentials directly.'
    });
  } catch (err: any) {
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

    const cached = registrationSocketCache.get(instanceName);
    if (!cached) {
      return res.status(400).json({ error: 'Sessão de registro expirada ou não encontrada. Solicite o código novamente.' });
    }

    return res.status(400).json({
      status: 'error',
      error: 'Primary registration via OTP/SMS is disabled on this version of Baileys. Please import credentials directly.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Obter QR Code / Conectar
router.get('/connect/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const phoneNumber = req.query.number as string | undefined;
    
    // Inicia a conexão se não estiver iniciada
    let active = ZapoManager.getActive(instanceName);
    if (!active) {
      try {
        active = await ZapoManager.connectClient(instanceName, phoneNumber);
      } catch (err: any) {
        console.warn(`[ZapoRouter] Falha ao iniciar cliente ${instanceName}:`, err.message);
        return res.status(200).json({
          code: '',
          count: 0,
          status: 'disconnected',
          error: err.message
        });
      }
    } else if (phoneNumber && !active.pairingCode) {
      // Se a instância já estiver ativa em modo QR mas não tiver gerado o código de pareamento,
      // desconecta e reconecta passando o phoneNumber para ativar o fluxo de pairing code corretamente
      try {
        console.log(`[ZapoRouter] Reiniciando instância ${instanceName} para gerar código de pareamento para o número ${phoneNumber}`);
        await ZapoManager.disconnectClient(instanceName);
        active = await ZapoManager.connectClient(instanceName, phoneNumber);
      } catch (err: any) {
        console.error(`[ZapoRouter] Erro ao reiniciar instância para pairing code:`, err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (!active) {
      return res.status(500).json({ error: 'Failed to initialize active instance client' });
    }

    // Se foi solicitado o número, aguarda até 12 segundos para obter o código de pareamento
    if (phoneNumber) {
      let attempts = 0;
      while (!active.pairingCode && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
    }

    // Se tiver código de pareamento em cache, retorna ele
    if (active.pairingCode) {
      return res.status(200).json({
        pairingCode: active.pairingCode,
        code: active.pairingCode,
        count: 0,
        status: 'connecting'
      });
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

// 3.1. Sincronizar Perfil Manualmente
router.post('/syncProfile/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    console.log(`[ZapoRouter] [SyncProfile] Solicitando sincronização manual de perfil para: ${instanceName}`);
    const result = await ZapoManager.syncProfile(instanceName);
    if (!result) {
      return res.status(400).json({ error: 'Instance not active or credentials missing.' });
    }
    return res.status(200).json(result);
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

    // Otimização: groupBy para contagem de chats e mensagens por instância (evita N+1 queries)
    const countWhere = instanceId
      ? { instanceName: { in: dbInstances.map(i => i.instanceName) } }
      : instanceName
      ? { instanceName: instanceName as string }
      : undefined;

    const [chatCounts, msgCounts] = await Promise.all([
      prisma.chatEntry.groupBy({
        by: ['instanceName'],
        where: countWhere,
        _count: { id: true }
      }),
      prisma.message.groupBy({
        by: ['instanceName'],
        where: countWhere,
        _count: { id: true }
      })
    ]);

    const chatMap = Object.fromEntries(chatCounts.map(r => [r.instanceName, r._count.id]));
    const msgMap = Object.fromEntries(msgCounts.map(r => [r.instanceName, r._count.id]));

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

      // Fallback dinâmico para preencher registeredPhone de instâncias antigas migradas
      const nameDigits = inst.instanceName.replace(/[^0-9]/g, '');
      const namePhone = nameDigits.length >= 10 ? nameDigits : '';
      const fallbackNumber = inst.registeredPhone || (ownerJid ? ownerJid.split('@')[0].split(':')[0] : '') || namePhone;

      return {
        id: inst.id,
        name: inst.instanceName,
        connectionStatus: state,
        instanceType: inst.mobileTransport ? (inst.registeredPhone ? 'primary' : 'mobile') : 'web',
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
        number: fallbackNumber,
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
          Message: msgMap[inst.instanceName] ?? 0,
          Contact: 0, // Nota: Sem model no Prisma local mapeado para contatos
          Chat: chatMap[inst.instanceName] ?? 0
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
    await ZapoManager.logoutClient(instanceName);
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
