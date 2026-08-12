import { prisma } from '../lib/prisma';
import { ZapoManager } from '../manager';
import { recordInstanceEvent } from './instanceEvents';

export type FieldType = 'text' | 'number' | 'date' | 'select';

export type FieldMapInput = {
  slotKey: string;
  label: string;
  fieldType: FieldType;
};

export type FieldMapRow = {
  instanceName: string;
  slotKey: string;
  label: string;
  fieldType: string;
};

const VALID_TYPES: FieldType[] = ['text', 'number', 'date', 'select'];

export class InvalidFieldError extends Error {
  constructor(key: string, reason: string) {
    super(`Campo inválido (${key}): ${reason}`);
    this.name = 'InvalidFieldError';
  }
}

export async function getFieldsMap(instanceName: string): Promise<FieldMapRow[]> {
  return prisma.instanceFieldMap.findMany({
    where: { instanceName },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateFieldsMap(
  instanceName: string,
  fields: FieldMapInput[]
): Promise<FieldMapRow[]> {
  const slotKeys = fields.map((f) => f.slotKey);

  for (const f of fields) {
    if (!VALID_TYPES.includes(f.fieldType)) {
      throw new InvalidFieldError(f.slotKey, `Tipo inválido '${f.fieldType}'`);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(f.slotKey)) {
      throw new InvalidFieldError(f.slotKey, 'Chave do slot deve conter apenas letras, números e underscores');
    }
  }

  await prisma.$transaction(async (tx) => {
    // Remove slots que não vieram mais na lista — overwrite idempotente do mapa completo.
    await tx.instanceFieldMap.deleteMany({
      where: {
        instanceName,
        slotKey: { notIn: slotKeys },
      },
    });

    for (const f of fields) {
      await tx.instanceFieldMap.upsert({
        where: {
          instanceName_slotKey: { instanceName, slotKey: f.slotKey },
        },
        create: {
          instanceName,
          slotKey: f.slotKey,
          label: f.label,
          fieldType: f.fieldType,
        },
        update: {
          label: f.label,
          fieldType: f.fieldType,
        },
      });
    }
  });

  const updatedMap = await getFieldsMap(instanceName);

  ZapoManager.emitEvent(instanceName, 'instance.fields_map_updated', { fields: updatedMap });

  await recordInstanceEvent({
    instanceName,
    type: 'fields_map_updated',
    severity: 'info',
    title: 'Mapa de campos de CRM atualizado',
    summary: `${fields.length} slots configurados`,
  });

  return updatedMap;
}

/** Retorna valores do lead resolvidos com label (`{"Empresa": "Acme Ltda"}`), não `{"field01": "..."}`. */
export async function getLead(instanceName: string, remoteJid: string): Promise<Record<string, unknown>> {
  const row = await prisma.chatEntry.findUnique({
    where: { instanceName_remoteJid: { instanceName, remoteJid } },
    select: { leadFields: true },
  });

  const fieldsMap = await getFieldsMap(instanceName);
  const rawFields = (row?.leadFields as Record<string, unknown>) || {};

  const resolved: Record<string, unknown> = {};
  for (const map of fieldsMap) {
    if (rawFields[map.slotKey] !== undefined) {
      resolved[map.label] = rawFields[map.slotKey];
    }
  }

  return resolved;
}

/** Valores brutos por slotKey, sem resolver label — usado internamente pra merge. */
export async function getLeadRaw(instanceName: string, remoteJid: string): Promise<Record<string, unknown>> {
  const row = await prisma.chatEntry.findUnique({
    where: { instanceName_remoteJid: { instanceName, remoteJid } },
    select: { leadFields: true },
  });
  return (row?.leadFields as Record<string, unknown>) || {};
}

export type LeadActor = { type: 'human' | 'agent' | 'webhook'; id: string };

export async function updateLead(
  instanceName: string,
  remoteJid: string,
  fields: Record<string, unknown>,
  actor: LeadActor
): Promise<Record<string, unknown>> {
  const currentRaw = await getLeadRaw(instanceName, remoteJid);
  const fieldsMap = await getFieldsMap(instanceName);
  const validSlotKeys = new Set(fieldsMap.map((f) => f.slotKey));

  const merged = { ...currentRaw };
  for (const [key, value] of Object.entries(fields)) {
    if (!validSlotKeys.has(key)) {
      throw new InvalidFieldError(key, 'Slot não está mapeado na instância');
    }
    merged[key] = value;
  }

  await prisma.chatEntry.upsert({
    where: { instanceName_remoteJid: { instanceName, remoteJid } },
    create: {
      instanceName,
      remoteJid,
      leadFields: merged as any, // Prisma.InputJsonValue exige shape que Record<string, unknown> não satisfaz diretamente
    },
    update: {
      leadFields: merged as any,
    },
  });

  const actorLabel = `${actor.type}:${actor.id}`;

  ZapoManager.emitEvent(instanceName, 'chat.lead_updated', {
    remoteJid,
    fields: merged,
    changedBy: actorLabel,
  });

  return getLead(instanceName, remoteJid);
}
