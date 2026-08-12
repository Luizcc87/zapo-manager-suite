import { prisma } from '../lib/prisma';
import { ZapoManager } from '../manager';
import { recordInstanceEvent } from './instanceEvents';

/**
 * Controle de handoff bot/humano por conversa (wa_chats.status).
 *
 * pending  — bot pode responder, ou fila sem dono.
 * open     — humano assumiu, bot bloqueado.
 * resolved — conversa encerrada.
 */

export type ConversationStatus = 'pending' | 'open' | 'resolved';

const VALID_STATUSES: ConversationStatus[] = ['pending', 'open', 'resolved'];

export type ConversationStatusRow = {
  instanceName: string;
  remoteJid: string;
  status: ConversationStatus;
  assignedUserId: string | null;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
};

export class InvalidStatusError extends Error {
  constructor(status: string) {
    super(`Status inválido: ${status}. Use um de: ${VALID_STATUSES.join(', ')}`);
    this.name = 'InvalidStatusError';
  }
}

export class BotBlockedError extends Error {
  constructor(instanceName: string, remoteJid: string, currentStatus: string) {
    super(
      `Envio de bot bloqueado para ${remoteJid} em ${instanceName}: status atual é '${currentStatus}', esperado 'pending'.`
    );
    this.name = 'BotBlockedError';
  }
}

export async function getConversationStatus(
  instanceName: string,
  remoteJid: string
): Promise<ConversationStatusRow> {
  const row = await prisma.chatEntry.findUnique({
    where: { instanceName_remoteJid: { instanceName, remoteJid } },
    select: {
      instanceName: true,
      remoteJid: true,
      status: true,
      assignedUserId: true,
      statusChangedAt: true,
      statusChangedBy: true,
    },
  });

  if (!row) {
    // Conversa ainda sem ChatEntry persistida — trata como pending por padrão, sem criar linha.
    return {
      instanceName,
      remoteJid,
      status: 'pending',
      assignedUserId: null,
      statusChangedAt: null,
      statusChangedBy: null,
    };
  }

  return row as ConversationStatusRow;
}

export type SetStatusActor = { type: 'human' | 'agent' | 'webhook'; id: string };

export async function setConversationStatus(
  instanceName: string,
  remoteJid: string,
  status: string,
  actor: SetStatusActor,
  opts: { autoAssign?: boolean } = {}
): Promise<ConversationStatusRow> {
  if (!VALID_STATUSES.includes(status as ConversationStatus)) {
    throw new InvalidStatusError(status);
  }

  const actorLabel = `${actor.type}:${actor.id}`;
  const now = new Date();
  const shouldAssign = opts.autoAssign && actor.type === 'human' && status === 'open';

  const updated = await prisma.chatEntry.upsert({
    where: { instanceName_remoteJid: { instanceName, remoteJid } },
    create: {
      instanceName,
      remoteJid,
      status,
      assignedUserId: shouldAssign ? actor.id : null,
      statusChangedAt: now,
      statusChangedBy: actorLabel,
    },
    update: {
      status,
      ...(shouldAssign ? { assignedUserId: actor.id } : {}),
      statusChangedAt: now,
      statusChangedBy: actorLabel,
    },
    select: {
      instanceName: true,
      remoteJid: true,
      status: true,
      assignedUserId: true,
      statusChangedAt: true,
      statusChangedBy: true,
    },
  });

  const result = updated as ConversationStatusRow;

  // Efeito 1: realtime pro painel.
  ZapoManager.emitEvent(instanceName, 'conversation.status', {
    remoteJid,
    status: result.status,
    assignedUserId: result.assignedUserId,
    changedBy: actorLabel,
  });

  // Efeito 2: evento auditável (reaproveita InstanceEvent existente).
  await recordInstanceEvent({
    instanceName,
    type: 'conversation_status_changed',
    severity: 'info',
    title: `Status da conversa alterado para "${result.status}"`,
    summary: `${remoteJid}: status -> ${result.status} (por ${actorLabel})`,
    details: { remoteJid, status: result.status, assignedUserId: result.assignedUserId, actor: actorLabel },
  });

  return result;
}

/**
 * Chamar antes de qualquer envio automático (bot/agente). Lança BotBlockedError
 * se a conversa já foi assumida por humano — nunca falha silenciosamente.
 */
export async function assertBotCanSend(instanceName: string, remoteJid: string): Promise<void> {
  const current = await getConversationStatus(instanceName, remoteJid);
  if (current.status !== 'pending') {
    throw new BotBlockedError(instanceName, remoteJid, current.status);
  }
}
