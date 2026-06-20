import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { checkInstanceApiKey } from '../middleware/auth';

const router = Router();

// POST /chat/findChats/:instanceName
// body: { where: {} } or { where: { remoteJid: string } }
router.post('/findChats/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const where = req.body?.where ?? {};

    let chats = ZapoManager.getChatList(instanceName);

    if (where.remoteJid) {
      chats = chats.filter((c) => c.remoteJid === where.remoteJid);
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

    const records = ZapoManager.getMessageList(instanceName, remoteJid);

    // Match the response shape the frontend expects:
    // response.data?.messages?.records OR response.data (array)
    return res.json({ messages: { records } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
