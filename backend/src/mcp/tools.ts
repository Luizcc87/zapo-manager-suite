import { z } from 'zod';
import { ZapoManager } from '../manager';
import { prisma } from '../lib/prisma';
import {
  getConversationStatus,
  setConversationStatus,
  assertBotCanSend,
  InvalidStatusError,
  BotBlockedError,
} from '../services/conversationStatus';
import { getLead, updateLead, updateFieldsMap, InvalidFieldError } from '../services/instanceFieldMap';

export interface McpContext {
  apiKey: string;
  type: 'global' | 'instance';
  instanceName?: string;
}

function formatJid(num: string): string {
  if (num.includes('@')) return num;
  return `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

export const mcpTools = [
  {
    name: 'list_instances',
    description: 'List all WhatsApp instances registered in Zapo Manager and their connection status.',
    paramsSchema: z.object({}),
    execute: async (_args: any, _ctx: McpContext) => {
      const instances = await prisma.instance.findMany({
        select: {
          instanceName: true,
          status: true,
          updatedAt: true,
        },
      });

      const result = instances.map((inst) => {
        const active = ZapoManager.getActive(inst.instanceName);
        return {
          instanceName: inst.instanceName,
          dbStatus: inst.status,
          connected: active?.client?.getState()?.connected ?? false,
          active: Boolean(active),
        };
      });

      return { instances: result };
    },
  },
  {
    name: 'get_instance_status',
    description: 'Get connection and operational status of a specific WhatsApp instance.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
    }),
    execute: async (args: { instanceName: string }, _ctx: McpContext) => {
      const { instanceName } = args;
      const instance = await prisma.instance.findUnique({
        where: { instanceName },
      });

      if (!instance) {
        return { error: 'Instance not found', instanceName };
      }

      const active = ZapoManager.getActive(instanceName);
      return {
        instanceName: instance.instanceName,
        status: instance.status,
        connected: active?.client?.getState()?.connected ?? false,
        active: Boolean(active),
        ownerJid: instance.ownerJid ?? null,
        mobileTransport: instance.mobileTransport ?? false,
        updatedAt: instance.updatedAt,
      };
    },
  },
  {
    name: 'send_text_message',
    description: 'Send a text message to a WhatsApp number via a connected instance. Requires instance to be online.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance to send from'),
      number: z.string().describe('Recipient phone number with country code (e.g. 5511999998888)'),
      text: z.string().describe('Message content text'),
    }),
    execute: async (args: { instanceName: string; number: string; text: string }, _ctx: McpContext) => {
      const { instanceName, number, text } = args;
      const jid = formatJid(number);

      try {
        await assertBotCanSend(instanceName, jid);
      } catch (err: any) {
        if (err instanceof BotBlockedError) {
          return { error: err.message, blocked: true, instanceName };
        }
        throw err;
      }

      const active = ZapoManager.getActive(instanceName);

      if (!active || !active.client.getState().connected) {
        return {
          error: 'Instance is offline or not connected',
          instanceName,
          connected: false,
        };
      }

      const sent = await active.client.message.send(jid, text as any);
      return {
        success: true,
        instanceName,
        recipient: jid,
        sent: Boolean(sent),
      };
    },
  },
  {
    name: 'send_media_message',
    description: 'Send a media file (image, document, audio, video) to a WhatsApp number via a connected instance.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      number: z.string().describe('Recipient phone number with country code'),
      mediaUrl: z.string().url().describe('Public URL of the media file to send'),
      mediaType: z.enum(['image', 'document', 'audio', 'video']).describe('Type of media'),
      caption: z.string().optional().describe('Optional caption text for the media'),
      fileName: z.string().optional().describe('Optional filename for documents'),
    }),
    execute: async (args: { instanceName: string; number: string; mediaUrl: string; mediaType: string; caption?: string; fileName?: string }, _ctx: McpContext) => {
      const { instanceName, number, mediaUrl, mediaType, caption, fileName } = args;
      const jid = formatJid(number);

      try {
        await assertBotCanSend(instanceName, jid);
      } catch (err: any) {
        if (err instanceof BotBlockedError) {
          return { error: err.message, blocked: true, instanceName };
        }
        throw err;
      }

      const active = ZapoManager.getActive(instanceName);

      if (!active || !active.client.getState().connected) {
        return {
          error: 'Instance is offline or not connected',
          instanceName,
          connected: false,
        };
      }

      let content: any = {};

      if (mediaType === 'image') content = { type: 'image', image: { url: mediaUrl }, caption };
      else if (mediaType === 'video') content = { type: 'video', video: { url: mediaUrl }, caption };
      else if (mediaType === 'audio') content = { type: 'audio', audio: { url: mediaUrl }, ptt: true };
      else content = { type: 'document', document: { url: mediaUrl }, caption, fileName: fileName || 'file' };

      const sent = await active.client.message.send(jid, content);
      return {
        success: true,
        instanceName,
        recipient: jid,
        sent: Boolean(sent),
      };
    },
  },
  {
    name: 'list_chats',
    description: 'List active chats and recent conversation summaries for an instance.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      limit: z.number().optional().describe('Maximum number of chats to return (default 20)'),
    }),
    execute: async (args: { instanceName: string; limit?: number }, _ctx: McpContext) => {
      const { instanceName, limit = 20 } = args;

      const chats = await prisma.chatEntry.findMany({
        where: { instanceName },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          remoteJid: true,
          pushName: true,
          updatedAt: true,
        },
      });

      return { instanceName, total: chats.length, chats };
    },
  },
  {
    name: 'get_qr_or_pairing_code',
    description: 'Fetch current QR Code or active status for pairing a new WhatsApp instance.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
    }),
    execute: async (args: { instanceName: string }, _ctx: McpContext) => {
      const { instanceName } = args;
      const instance = await prisma.instance.findUnique({ where: { instanceName } });
      if (!instance) return { error: 'Instance not found' };

      const active = ZapoManager.getActive(instanceName);
      return {
        instanceName,
        status: instance.status,
        qrCode: active?.qrCode ?? null,
        pairingCode: active?.pairingCode ?? null,
        connected: active?.client?.getState()?.connected ?? false,
      };
    },
  },
  {
    name: 'get_conversation_status',
    description:
      'Check the bot/human handoff status of a conversation (pending|open|resolved) before sending an automated message. ' +
      'If status is not "pending", a human has taken over — do not send.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      remoteJid: z.string().describe('Recipient JID (e.g. 5511999998888@s.whatsapp.net) or phone number'),
    }),
    execute: async (args: { instanceName: string; remoteJid: string }, _ctx: McpContext) => {
      const { instanceName, remoteJid } = args;
      const jid = formatJid(remoteJid);
      return getConversationStatus(instanceName, jid);
    },
  },
  {
    name: 'update_conversation_status',
    description:
      'Update the bot/human handoff status of a conversation. Use status="pending" to release control back to the bot, ' +
      'or "resolved" to close the conversation. Do not set "open" unless a human is actually taking over.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      remoteJid: z.string().describe('Recipient JID (e.g. 5511999998888@s.whatsapp.net) or phone number'),
      status: z.enum(['pending', 'open', 'resolved']).describe('New conversation status'),
    }),
    execute: async (args: { instanceName: string; remoteJid: string; status: string }, ctx: McpContext) => {
      const { instanceName, remoteJid, status } = args;
      const jid = formatJid(remoteJid);
      try {
        const updated = await setConversationStatus(instanceName, jid, status, {
          type: 'agent',
          id: ctx.instanceName ? `mcp:${ctx.instanceName}` : 'mcp:global',
        });
        return updated;
      } catch (err: any) {
        if (err instanceof InvalidStatusError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  },
  {
    name: 'update_fields_map',
    description: 'Update the CRM fields mapping for a WhatsApp instance. Defines the expected slots like field01, field02.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      fields: z.array(z.object({
        slotKey: z.string(),
        label: z.string(),
        fieldType: z.enum(['text', 'number', 'date', 'select']),
      })).describe('Array of field definitions'),
    }),
    execute: async (args: { instanceName: string; fields: any[] }, _ctx: McpContext) => {
      const { instanceName, fields } = args;
      try {
        const updated = await updateFieldsMap(instanceName, fields);
        return { instanceName, fields: updated };
      } catch (err: any) {
        if (err.name === 'InvalidFieldError') {
          return { error: err.message };
        }
        throw err;
      }
    },
  },
  {
    name: 'get_lead',
    description: 'Get the populated CRM fields for a specific contact.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      remoteJid: z.string().describe('Recipient JID or phone number'),
    }),
    execute: async (args: { instanceName: string; remoteJid: string }, _ctx: McpContext) => {
      const { instanceName, remoteJid } = args;
      const jid = formatJid(remoteJid);
      return await getLead(instanceName, jid);
    },
  },
  {
    name: 'update_lead',
    description: 'Update the CRM field values for a specific contact. Use the exact slotKeys defined in the fields_map.',
    paramsSchema: z.object({
      instanceName: z.string().describe('Name of the WhatsApp instance'),
      remoteJid: z.string().describe('Recipient JID or phone number'),
      fields: z.record(z.string(), z.any()).describe('Key-value pairs of slotKey to value'),
    }),
    execute: async (args: { instanceName: string; remoteJid: string; fields: Record<string, any> }, ctx: McpContext) => {
      const { instanceName, remoteJid, fields } = args;
      const jid = formatJid(remoteJid);
      try {
        const updated = await updateLead(
          instanceName,
          jid,
          fields,
          { type: 'agent', id: ctx.instanceName ? `mcp:${ctx.instanceName}` : 'mcp:global' }
        );
        return updated;
      } catch (err: any) {
        if (err.name === 'InvalidFieldError') {
          return { error: err.message };
        }
        throw err;
      }
    },
  }
];
