import { prisma } from '../lib/prisma';

export type InstanceEventSeverity = 'info' | 'warning' | 'critical';

export type CreateInstanceEventInput = {
  instanceName: string;
  type: string;
  severity: InstanceEventSeverity;
  title: string;
  summary: string;
  details?: unknown;
};

export async function recordInstanceEvent(input: CreateInstanceEventInput) {
  try {
    return await prisma.instanceEvent.create({
      data: {
        instanceName: input.instanceName,
        type: input.type,
        severity: input.severity,
        title: input.title,
        summary: input.summary,
        details: input.details === undefined ? undefined : (input.details as any),
      },
    });
  } catch (err: any) {
    console.warn(`[InstanceEvents] Falha ao persistir evento ${input.type} para ${input.instanceName}:`, err.message);
    return null;
  }
}

export async function listInstanceEvents(instanceName: string, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return prisma.instanceEvent.findMany({
    where: { instanceName },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });
}

export async function summarizeInstanceEvents(instanceName: string, days = 7) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const where = {
    instanceName,
    createdAt: {
      gte: since,
    },
  };

  const [bySeverity, byType, unreadCount, lastCritical] = await Promise.all([
    prisma.instanceEvent.groupBy({
      by: ['severity'],
      where,
      _count: { id: true },
    }),
    prisma.instanceEvent.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    prisma.instanceEvent.count({
      where: {
        ...where,
        readAt: null,
      },
    }),
    prisma.instanceEvent.findFirst({
      where: {
        ...where,
        severity: 'critical',
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const severityCounts = Object.fromEntries(bySeverity.map(item => [item.severity, item._count.id]));
  const total = bySeverity.reduce((sum, item) => sum + item._count.id, 0);

  return {
    instanceName,
    days: safeDays,
    since,
    total,
    unreadCount,
    severity: {
      info: severityCounts.info ?? 0,
      warning: severityCounts.warning ?? 0,
      critical: severityCounts.critical ?? 0,
    },
    topTypes: byType.map(item => ({
      type: item.type,
      count: item._count.id,
    })),
    lastCritical: lastCritical ? {
      id: lastCritical.id,
      type: lastCritical.type,
      title: lastCritical.title,
      summary: lastCritical.summary,
      createdAt: lastCritical.createdAt,
      readAt: lastCritical.readAt,
    } : null,
  };
}

type InstanceEventsSummary = Awaited<ReturnType<typeof summarizeInstanceEvents>>;

export function formatInstanceEventsSummary(summary: InstanceEventsSummary) {
  const topTypes = summary.topTypes.length
    ? summary.topTypes.map(item => `${item.type}: ${item.count}`).join('\n')
    : 'Nenhum tipo recorrente no periodo.';

  const lastCritical = summary.lastCritical
    ? `${summary.lastCritical.title} - ${summary.lastCritical.summary}`
    : 'Nenhum evento critico no periodo.';

  return [
    `Periodo: ultimos ${summary.days} dias`,
    `Total de eventos: ${summary.total}`,
    `Nao lidos: ${summary.unreadCount}`,
    '',
    `Criticos: ${summary.severity.critical}`,
    `Atencao: ${summary.severity.warning}`,
    `Info: ${summary.severity.info}`,
    '',
    'Tipos principais:',
    topTypes,
    '',
    `Ultimo critico: ${lastCritical}`,
  ].join('\n');
}

export async function markInstanceEventRead(instanceName: string, eventId: string) {
  return prisma.instanceEvent.updateMany({
    where: { id: eventId, instanceName },
    data: { readAt: new Date() },
  });
}

export function getInstanceEventsRetentionDays() {
  const raw = Number(process.env.INSTANCE_EVENTS_RETENTION_DAYS);
  if (!Number.isFinite(raw)) return 30;
  if (raw <= 0) return 0;
  return Math.floor(raw);
}

export function getInstanceEventsRetentionCutoff(now = new Date(), days = getInstanceEventsRetentionDays()) {
  if (days <= 0) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function pruneOldInstanceEvents(now = new Date()) {
  const cutoff = getInstanceEventsRetentionCutoff(now);
  if (!cutoff) return { count: 0, disabled: true };

  const result = await prisma.instanceEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  return { count: result.count, disabled: false, cutoff };
}
