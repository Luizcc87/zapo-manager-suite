import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const prisma = new PrismaClient();
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper para formatar o número do WhatsApp no formato JID
function formatJid(num: string): string {
  if (num.includes('@')) return num;
  // Remove tudo que não for número e concatena o domínio
  return `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

// Salva o buffer em arquivo temporário para processamento seguro no sharp/ffmpeg
function saveTempFile(buffer: Buffer, originalname: string): string {
  const tempDir = os.tmpdir();
  const safeName = path.basename(originalname).replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `zapo_${Date.now()}_${safeName}`;
  const tempPath = path.join(tempDir, filename);
  // Garantia extra: o path resolvido deve estar dentro do tempDir
  if (!tempPath.startsWith(fs.realpathSync(tempDir))) {
    throw new Error('Invalid file path');
  }
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

// Middleware de Autenticação de Instância
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

// 1. Enviar Texto
router.post('/sendText/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, text, options } = req.body;

    if (!number || !text) {
      return res.status(400).json({ error: 'number and text are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = formatJid(number);
    const sentMsg = await active.client.message.send(jid, text, options);

    return res.status(201).json({
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        conversation: text
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Enviar Mídia (Suporta JSON e Multipart/Form-data)
router.post('/sendMedia/:instanceName', checkInstanceApiKey, upload.single('file'), async (req: Request, res: Response) => {
  let tempPath: string | null = null;
  try {
    const { instanceName } = req.params;
    
    // Captura campos do Multipart ou do JSON Body
    const number = req.body.number;
    const caption = req.body.caption || '';
    const mimetype = req.body.mimetype || (req.file ? req.file.mimetype : '');
    const mediaUrl = req.body.mediaUrl; // Se enviar via URL em JSON

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = formatJid(number);
    let mediaInput: any;

    if (req.file) {
      // Se enviou arquivo físico, escreve temporariamente em disco para processamento
      tempPath = saveTempFile(req.file.buffer, req.file.originalname);
      mediaInput = tempPath;
    } else if (mediaUrl) {
      mediaInput = mediaUrl;
    } else {
      return res.status(400).json({ error: 'Either file upload or mediaUrl is required' });
    }

    // Determinar tipo do media baseado em Mimetype
    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (mimetype.startsWith('image/')) mediaType = 'image';
    else if (mimetype.startsWith('video/')) mediaType = 'video';
    else if (mimetype.startsWith('audio/')) mediaType = 'audio';

    const sendPayload: any = {
      type: mediaType,
      media: mediaInput,
      mimetype: mimetype,
      caption: caption
    };

    if (mediaType === 'document' && req.file) {
      sendPayload.fileName = req.file.originalname;
    }

    const sentMsg = await active.client.message.send(jid, sendPayload);

    const returnedMsg: any = {};
    if (mediaType === 'image') returnedMsg.imageMessage = { caption };
    else if (mediaType === 'video') returnedMsg.videoMessage = { caption };
    else if (mediaType === 'audio') returnedMsg.audioMessage = {};
    else returnedMsg.documentMessage = { caption, fileName: req.file ? req.file.originalname : undefined };

    return res.status(201).json({
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    // Limpeza de arquivo temporário
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }
  }
});

// 3. Enviar Sticker (Apenas wrapper de mídia com tipo sticker)
router.post('/sendSticker/:instanceName', checkInstanceApiKey, upload.single('file'), async (req: Request, res: Response) => {
  let tempPath: string | null = null;
  try {
    const { instanceName } = req.params;
    const number = req.body.number;
    
    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = formatJid(number);
    let mediaInput: any;

    if (req.file) {
      tempPath = saveTempFile(req.file.buffer, req.file.originalname);
      mediaInput = tempPath;
    } else if (req.body.mediaUrl) {
      mediaInput = req.body.mediaUrl;
    } else {
      return res.status(400).json({ error: 'File upload or mediaUrl is required' });
    }

    const sentMsg = await active.client.message.send(jid, {
      type: 'sticker',
      media: mediaInput,
      mimetype: 'image/webp'
    });

    return res.status(201).json({
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        stickerMessage: {}
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }
  }
});

export default router;
