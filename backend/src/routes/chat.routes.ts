import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';
import { checkInstanceApiKey } from '../middleware/auth';
import {
  getConversationStatus,
  setConversationStatus,
  InvalidStatusError,
  type SetStatusActor,
} from '../services/conversationStatus';
import { getLead, getLeadRaw, updateLead, InvalidFieldError } from '../services/instanceFieldMap';

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

// GET /chat/:instanceName/:remoteJid/status
// Consulta o status de handoff (pending|open|resolved) — agente deve checar antes de enviar.
router.get('/:instanceName/:remoteJid/status', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, remoteJid } = req.params;
    const current = await getConversationStatus(instanceName, decodeURIComponent(remoteJid));
    return res.json(current);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /chat/:instanceName/:remoteJid/status
// body: { status: 'pending'|'open'|'resolved', actor: { type: 'human'|'agent'|'webhook', id: string }, autoAssign?: boolean }
// Superfície única de escrita reaproveitada por UI, webhooks externos e MCP tools.
router.patch('/:instanceName/:remoteJid/status', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, remoteJid } = req.params;
    const { status, actor, autoAssign } = req.body ?? {};

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!actor || typeof actor.type !== 'string' || typeof actor.id !== 'string') {
      return res.status(400).json({ error: 'actor { type, id } is required' });
    }
    if (!['human', 'agent', 'webhook'].includes(actor.type)) {
      return res.status(400).json({ error: "actor.type must be 'human', 'agent' or 'webhook'" });
    }

    const updated = await setConversationStatus(
      instanceName,
      decodeURIComponent(remoteJid),
      status,
      actor as SetStatusActor,
      { autoAssign: Boolean(autoAssign) }
    );

    return res.json(updated);
  } catch (err: any) {
    if (err instanceof InvalidStatusError) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

// GET /chat/:instanceName/:remoteJid/lead
// ?raw=true retorna valores por slotKey (uso interno de formulário); default retorna resolvido por label.
router.get('/:instanceName/:remoteJid/lead', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, remoteJid } = req.params;
    const jid = decodeURIComponent(remoteJid);
    const lead = req.query.raw === 'true'
      ? await getLeadRaw(instanceName, jid)
      : await getLead(instanceName, jid);
    return res.json(lead);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /chat/:instanceName/:remoteJid/lead
router.patch('/:instanceName/:remoteJid/lead', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName, remoteJid } = req.params;
    const { fields, actor } = req.body ?? {};

    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields must be an object' });
    }
    if (!actor || typeof actor.type !== 'string' || typeof actor.id !== 'string') {
      return res.status(400).json({ error: 'actor { type, id } is required' });
    }
    if (!['human', 'agent', 'webhook'].includes(actor.type)) {
      return res.status(400).json({ error: "actor.type must be 'human', 'agent' or 'webhook'" });
    }

    const updated = await updateLead(
      instanceName,
      decodeURIComponent(remoteJid),
      fields,
      actor as { type: 'human' | 'agent' | 'webhook'; id: string }
    );

    return res.json(updated);
  } catch (err: any) {
    if (err instanceof InvalidFieldError || err.name === 'InvalidFieldError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

// GET /chat/debug/:instanceName  — diagnóstico temporário (remover após investigação)
router.get('/debug/:instanceName', checkInstanceApiKey, (req: Request, res: Response) => {
  const { instanceName } = req.params;
  return res.json(ZapoManager.debugState(instanceName));
});

export default router;
