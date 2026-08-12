import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { checkInstanceApiKey } from '../middleware/auth';

const router = Router();

function getBrazilMobileJidAliases(remoteJid: string): string[] {
  const match = remoteJid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return [remoteJid];

  const digits = match[1];
  const aliases = new Set<string>([remoteJid]);

  if (digits.startsWith('55')) {
    if (digits.length === 12) {
      aliases.add(`${digits.slice(0, 4)}9${digits.slice(4)}@s.whatsapp.net`);
    } else if (digits.length === 13 && digits[4] === '9') {
      aliases.add(`${digits.slice(0, 4)}${digits.slice(5)}@s.whatsapp.net`);
    }
  }

  return Array.from(aliases);
}

// POST /chat/findChats/:instanceName
// body: { where: {} } or { where: { remoteJid: string } }
router.post('/findChats/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const where = req.body?.where ?? {};

    let chats = await ZapoManager.getChatList(instanceName);

    if (where.remoteJid) {
      const aliases = new Set(getBrazilMobileJidAliases(where.remoteJid));
      chats = chats.filter((c) => aliases.has(c.remoteJid));
    }

    return res.json(chats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /chat/findMessages/:instanceName
// body: { where: { key: { remoteJid: string } } }
router.post('/findMessages/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const remoteJid: string | undefined = req.body?.where?.key?.remoteJid;

    if (!remoteJid) {
      return res.status(400).json({ error: 'where.key.remoteJid is required' });
    }

    const records = await ZapoManager.getMessageList(instanceName, remoteJid);

    // Match the response shape the frontend expects:
    // response.data?.messages?.records OR response.data (array)
    return res.json({ messages: { records } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /chat/debug/:instanceName  — diagnóstico temporário (remover após investigação)
router.get('/debug/:instanceName', checkInstanceApiKey, (req: Request, res: Response) => {
  const { instanceName } = req.params;
  return res.json(ZapoManager.debugState(instanceName));
});

export default router;
