import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { proto } from 'zapo-js';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { checkStrictInstanceApiKey } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/status/:instanceName/:messageId', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, messageId } = req.params;
    const instance = await prisma.instance.findUnique({ where: { instanceName } });
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const status = ZapoManager.getMessageStatus(instanceName, messageId);
    if (!status) {
      return res.status(404).json({ error: 'Message status not found' });
    }

    return res.status(200).json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper para formatar o número do WhatsApp no formato JID
function formatJid(num: string): string {
  if (num.includes('@')) return num;
  // Remove tudo que não for número e concatena o domínio
  return `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

// Cache local em memória para evitar requisições repetidas ao WhatsApp (por sessão e número)
const resolvedJidCache = new Map<string, string>();

type LinkPreviewImageInput = {
  url?: string;
  data?: string;
};

type LinkPreviewInput = {
  url?: string;
  title?: string;
  description?: string;
  image?: LinkPreviewImageInput;
};

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ZapoManager/1.0)'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download link preview image: ${url} (HTTP ${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function buildLinkPreviewThumbnail(image?: LinkPreviewImageInput): Promise<{ bytes: Uint8Array; width: number; height: number } | undefined> {
  if (!image) return undefined;

  let input: Buffer | undefined;
  if (typeof image.url === 'string' && image.url.trim()) {
    input = await fetchBuffer(image.url.trim());
  } else if (typeof image.data === 'string' && image.data.trim()) {
    const base64 = image.data.includes(',') ? image.data.split(',').pop()! : image.data;
    input = Buffer.from(base64, 'base64');
  }

  if (!input) return undefined;

  const bytes = await sharp(input)
    .resize(640, 640, { fit: 'contain', background: 'white' })
    .flatten({ background: 'white' })
    .jpeg({ quality: 86 })
    .toBuffer();

  return { bytes, width: 640, height: 640 };
}

async function buildSendTextContent(body: any): Promise<any> {
  const textInput = body.textMessage?.text ?? body.text;
  const preview: LinkPreviewInput | undefined = body.preview;
  const hasPreviewOverride = preview && typeof preview === 'object';

  if (typeof textInput === 'object' && textInput !== null) {
    return normalizeLinkPreviewContent(textInput);
  }

  if (hasPreviewOverride) {
    const thumbnail = await buildLinkPreviewThumbnail(preview.image);
    return normalizeLinkPreviewContent({
      type: 'text',
      text: textInput,
      linkPreview: {
        matchedText: preview.url,
        title: preview.title,
        description: preview.description,
        ...(thumbnail ? { thumbnail } : {}),
      },
    });
  }

  if (body.linkPreview !== undefined) {
    return {
      type: 'text',
      text: textInput,
      linkPreview: body.linkPreview,
    };
  }

  return textInput;
}

function sanitizeMessageLog(content: any): string {
  if (typeof content === 'string') return content;
  return JSON.stringify(content, (key, value) => {
    if (key === 'bytes' && (value instanceof Uint8Array || Buffer.isBuffer(value))) {
      return `[${value.byteLength} bytes]`;
    }
    return value;
  });
}

function normalizeLinkPreviewContent(content: any): any {
  if (
    typeof content !== 'object'
    || content === null
    || typeof content.linkPreview !== 'object'
    || content.linkPreview === null
    || typeof content.linkPreview.thumbnail !== 'object'
    || content.linkPreview.thumbnail === null
  ) {
    return content;
  }

  const thumbnail = content.linkPreview.thumbnail;
  let bytes = thumbnail.bytes;
  if (Array.isArray(bytes)) {
    bytes = Uint8Array.from(bytes);
  } else if (typeof bytes === 'string') {
    bytes = Buffer.from(bytes, 'base64');
  }

  if (Buffer.isBuffer(bytes)) {
    bytes = new Uint8Array(bytes);
  }

  if (!(bytes instanceof Uint8Array)) {
    return content;
  }

  return {
    ...content,
    linkPreview: {
      ...content.linkPreview,
      previewType: content.linkPreview.previewType ?? proto.Message.ExtendedTextMessage.PreviewType.IMAGE,
      thumbnail: {
        ...thumbnail,
        bytes,
      },
    },
  };
}

// Helper para resolver dinamicamente o JID correto no WhatsApp (tratando o 9 extra brasileiro)
async function resolveJid(client: any, num: string): Promise<string> {
  const cleanNum = num.replace(/[^0-9]/g, '');
  if (num.includes('@')) return num;

  const cacheKey = `${client.sessionId}:${cleanNum}`;
  if (resolvedJidCache.has(cacheKey)) {
    return resolvedJidCache.get(cacheKey)!;
  }

  let resolvedJid = `${cleanNum}@s.whatsapp.net`;

  if (cleanNum.startsWith('55')) {
    let alternateNum = '';
    if (cleanNum.length === 13) {
      // 13 dígitos (com o 9) -> deriva o formato de 12 dígitos (sem o 9)
      alternateNum = cleanNum.slice(0, 4) + cleanNum.slice(5);
    } else if (cleanNum.length === 12) {
      // 12 dígitos (sem o 9) -> deriva o formato de 13 dígitos (com o 9)
      alternateNum = cleanNum.slice(0, 4) + '9' + cleanNum.slice(4);
    }

    if (alternateNum) {
      try {
        const results = await client.profile.getLidsByPhoneNumbers([cleanNum, alternateNum]);
        const found = results.find((r: any) => r.exists);
        if (found) {
          resolvedJid = found.phoneJid || found.lidJid || resolvedJid;
        }
      } catch (e) {
        // Ignora erro de rede e usa o padrão
      }
    }
  }

  resolvedJidCache.set(cacheKey, resolvedJid);
  return resolvedJid;
}

// Baixa uma URL HTTP/HTTPS e salva em arquivo temporário
// zapo-js trata 'string' como caminho local — URLs devem ser pré-baixadas
async function downloadMediaUrl(url: string, mimetype: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      // Alguns servidores bloqueiam bots sem User-Agent
      'User-Agent': 'Mozilla/5.0 (compatible; ZapoManager/1.0)'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download media from URL: ${url} (HTTP ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // Derivar extensão do mimetype para o arquivo temporário
  const ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
  return saveTempFile(buffer, `download.${ext}`);
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


// 0. Enviar Áudio (PTT / Voice Note) — base64
router.post('/sendWhatsAppAudio/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  let tempPath: string | null = null;
  try {
    const { instanceName } = req.params;
    const number: string = req.body.number;
    const audioBase64: string = req.body.audioMessage?.audio ?? req.body.audio;

    if (!number || !audioBase64) {
      return res.status(400).json({ error: 'number and audioMessage.audio (base64) are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const buffer = Buffer.from(audioBase64, 'base64');
    tempPath = saveTempFile(buffer, 'audio.ogg');

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=audio (ptt), to=${jid}`);
    const sentMsg = await active.client.message.send(jid, {
      type: 'audio',
      media: tempPath,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=audio (ptt), to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: {
        audioMessage: {
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: { remoteJid: jid, fromMe: true, id: sentMsg.id },
      message: { audioMessage: { ptt: true } },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendWhatsAppAudio error:`, err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  }
});

// 1. Enviar Texto
router.post('/sendText/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, options } = req.body;
    const text = req.body.textMessage?.text ?? req.body.text;

    if (!number || !text) {
      return res.status(400).json({ error: 'number and text are required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);
    const content = await buildSendTextContent(req.body);
    const linkPreviewRequested = typeof content === 'object' && content !== null && 'linkPreview' in content;
    if (linkPreviewRequested) {
      console.log(`[MessageRoutes] sendText linkPreview requested for ${instanceName}`);
    }
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=text, to=${jid}, content=${sanitizeMessageLog(content)}`);
    const sentMsg = await active.client.message.send(jid, content, options);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=text, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: typeof text === 'object' && text !== null ? {
        extendedTextMessage: {
          text: text.text,
        }
      } : {
        conversation: text,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: typeof text === 'object' && text !== null ? text : {
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
router.post('/sendMedia/:instanceName', checkStrictInstanceApiKey, upload.single('file'), async (req: Request, res: Response) => {
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

    const jid = await resolveJid(active.client, number);
    let mediaInput: any;

    if (req.file) {
      // Se enviou arquivo físico, escreve temporariamente em disco para processamento
      tempPath = saveTempFile(req.file.buffer, req.file.originalname);
      mediaInput = tempPath;
    } else if (mediaUrl) {
      // zapo-js só aceita paths locais ou Buffers — baixar a URL antes de enviar
      tempPath = await downloadMediaUrl(mediaUrl, mimetype);
      mediaInput = tempPath;
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

    if (mediaType === 'document') {
      // fileName com 'N' maiúsculo conforme AGENTS.md
      sendPayload.fileName = req.file ? req.file.originalname : (mediaUrl ? mediaUrl.split('/').pop()?.split('?')[0] || 'document.bin' : 'document.bin');
    }

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=${mediaType}, to=${jid}, caption=${caption}, hasFile=${!!req.file}, hasUrl=${!!mediaUrl}`);
    const sentMsg = await active.client.message.send(jid, sendPayload);
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=${mediaType}, to=${jid}, id=${sentMsg.id}`);

    const returnedMsg: any = {};
    if (mediaType === 'image') returnedMsg.imageMessage = { caption };
    else if (mediaType === 'video') returnedMsg.videoMessage = { caption };
    else if (mediaType === 'audio') returnedMsg.audioMessage = {};
    else returnedMsg.documentMessage = { caption, fileName: sendPayload.fileName };

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: returnedMsg,
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
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
    console.error(`[MessageRoutes] sendMedia error:`, err.message, err.stack?.split('\n').slice(0, 4).join(' | '));
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
router.post('/sendSticker/:instanceName', checkStrictInstanceApiKey, upload.single('file'), async (req: Request, res: Response) => {
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

    const jid = await resolveJid(active.client, number);
    let mediaInput: any;

    if (req.file) {
      tempPath = saveTempFile(req.file.buffer, req.file.originalname);
      mediaInput = tempPath;
    } else if (req.body.mediaUrl) {
      // zapo-js só aceita paths locais — baixar a URL antes de enviar
      tempPath = await downloadMediaUrl(req.body.mediaUrl, 'image/webp');
      mediaInput = tempPath;
    } else {
      return res.status(400).json({ error: 'File upload or mediaUrl is required' });
    }

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=sticker, to=${jid}, hasFile=${!!req.file}, hasUrl=${!!req.body.mediaUrl}`);
    const sentMsg = await active.client.message.send(jid, {
      type: 'sticker',
      media: mediaInput,
      mimetype: 'image/webp'
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=sticker, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: {
        stickerMessage: {
          url: req.body.mediaUrl || undefined
        },
        mediaUrl: req.body.mediaUrl || undefined
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        stickerMessage: {
          url: req.body.mediaUrl || undefined
        },
        mediaUrl: req.body.mediaUrl || undefined
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    console.error(`[MessageRoutes] sendSticker error:`, err.message, err.stack?.split('\n').slice(0, 4).join(' | '));
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }
  }
});

// 4. Enviar Botões (Interactive / Buttons)
router.post('/sendButtons/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, title, description, footer, buttons } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);

    const nativeFlowButtons: any[] = [];
    if (Array.isArray(buttons)) {
      for (const btn of buttons) {
        if (btn.type === 'reply') {
          nativeFlowButtons.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              id: btn.id
            })
          });
        } else if (btn.type === 'url') {
          nativeFlowButtons.push({
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              url: btn.url,
              merchant_url: btn.url
            })
          });
        } else if (btn.type === 'copy') {
          nativeFlowButtons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText,
              id: 'copy_code',
              copy_code: btn.copyCode
            })
          });
        } else if (btn.type === 'pix') {
          nativeFlowButtons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: btn.displayText || `PIX - ${btn.name || ''}`,
              id: 'copy_code',
              copy_code: btn.key
            })
          });
        }
      }
    }

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=buttons, to=${jid}, title=${title}, buttonsCount=${nativeFlowButtons.length}`);
    const sentMsg = await active.client.message.send(jid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: title ? { title, hasMediaAttachment: false } : undefined,
            body: { text: description || '' },
            footer: footer ? { text: footer } : undefined,
            nativeFlowMessage: {
              buttons: nativeFlowButtons,
              messageVersion: 1
            }
          }
        }
      }
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=buttons, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: title ? { title, hasMediaAttachment: false } : undefined,
              body: { text: description || '' },
              footer: footer ? { text: footer } : undefined,
              nativeFlowMessage: {
                buttons: nativeFlowButtons,
                messageVersion: 1
              }
            }
          }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        interactiveMessage: {
          body: { text: description || '' }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Enviar List (List Message)
router.post('/sendList/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, title, description, footerText, buttonText, sections } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);

    const listParams = {
      title: buttonText || 'Ver opções',
      sections: Array.isArray(sections) ? sections.map((sec: any) => ({
        title: sec.title || '',
        rows: Array.isArray(sec.rows) ? sec.rows.map((row: any) => ({
          id: row.rowId || row.id || '',
          title: row.title || '',
          description: row.description || ''
        })) : []
      })) : []
    };

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=list, to=${jid}, title=${title}, sectionsCount=${sections?.length}`);
    const sentMsg = await active.client.message.send(jid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: title ? { title, hasMediaAttachment: false } : undefined,
            body: { text: description || '' },
            footer: footerText ? { text: footerText } : undefined,
            nativeFlowMessage: {
              buttons: [
                {
                  name: 'single_select',
                  buttonParamsJson: JSON.stringify(listParams)
                }
              ],
              messageVersion: 1
            }
          }
        }
      }
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=list, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: title ? { title, hasMediaAttachment: false } : undefined,
              body: { text: description || '' },
              footer: footerText ? { text: footerText } : undefined,
              nativeFlowMessage: {
                buttons: [
                  {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify(listParams)
                  }
                ],
                messageVersion: 1
              }
            }
          }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        listMessage: {
          title: title || ''
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Enviar Carousel (Carousel Message)
router.post('/sendCarousel/:instanceName', checkStrictInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { number, body, cards } = req.body;

    if (!number) {
      return res.status(400).json({ error: 'number is required' });
    }

    const active = ZapoManager.getActive(instanceName);
    if (!active) {
      return res.status(503).json({ error: 'Instance is disconnected or offline' });
    }

    const jid = await resolveJid(active.client, number);

    const interactiveCards: any[] = [];
    if (Array.isArray(cards)) {
      for (const card of cards) {
        const cardButtons: any[] = [];
        if (Array.isArray(card.buttons)) {
          for (const btn of card.buttons) {
            if (btn.type === 'url') {
              cardButtons.push({
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                  display_text: btn.displayText,
                  url: btn.url,
                  merchant_url: btn.url
                })
              });
            } else if (btn.type === 'reply') {
              cardButtons.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: btn.displayText,
                  id: btn.id
                })
              });
            }
          }
        }

        interactiveCards.push({
          body: { text: card.body || '' },
          footer: card.footer ? { text: card.footer } : undefined,
          nativeFlowMessage: {
            buttons: cardButtons,
            messageVersion: 1
          }
        });
      }
    }

    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENDING] type=carousel, to=${jid}, cardsCount=${cards?.length}`);
    const sentMsg = await active.client.message.send(jid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: body || '' },
            carouselMessage: {
              cards: interactiveCards,
              messageVersion: 1
            }
          }
        }
      }
    });
    console.log(`[ZapoManager] [${instanceName}] [MESSAGE SENT] type=carousel, to=${jid}, id=${sentMsg.id}`);

    const msgData = {
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id,
      },
      message: {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: body || '' },
              carouselMessage: {
                cards: interactiveCards,
                messageVersion: 1
              }
            }
          }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: undefined,
    };
    ZapoManager.recordSentMessage(instanceName, msgData);

    return res.status(201).json({
      accepted: true,
      key: {
        remoteJid: jid,
        fromMe: true,
        id: sentMsg.id
      },
      message: {
        interactiveMessage: {
          body: { text: body || '' }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
