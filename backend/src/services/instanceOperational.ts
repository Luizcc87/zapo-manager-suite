import { prisma } from '../lib/prisma';

type ProxyStatus = {
  connected?: boolean;
  error?: string;
  details?: string;
};

export function classifyProxyHealth(proxyEnabled: boolean, proxyStatus?: ProxyStatus) {
  if (!proxyEnabled) {
    return { severity: 'ok' as const, reason: null };
  }

  if (!proxyStatus || proxyStatus.connected !== false) {
    return { severity: 'ok' as const, reason: null };
  }

  const raw = `${proxyStatus.details || ''} ${proxyStatus.error || ''}`.trim();
  const lower = raw.toLowerCase();
  let reason = raw || 'proxy_failed';

  if (lower.includes('407')) reason = 'proxy_auth_407';
  else if (lower.includes('402')) reason = 'proxy_payment_402';
  else if (lower.includes('timeout') || lower.includes('timed out')) reason = 'proxy_timeout';
  else if (lower.includes('host') || lower.includes('port')) reason = 'proxy_config_incomplete';

  return { severity: 'critical' as const, reason };
}

export async function getChatActivityByInstance(instanceNames: string[]) {
  const uniqueNames = [...new Set(instanceNames.filter(Boolean))];
  if (!uniqueNames.length) return {};

  const rows = await prisma.chatEntry.findMany({
    where: { instanceName: { in: uniqueNames } },
    orderBy: { updatedAt: 'desc' },
    select: { instanceName: true, remoteJid: true, updatedAt: true },
  });

  const byInstance: Record<string, { lastUpdatedAt: string | null; lastRemoteJid: string | null }> = {};
  for (const row of rows) {
    if (byInstance[row.instanceName]) continue;
    byInstance[row.instanceName] = {
      lastUpdatedAt: row.updatedAt.toISOString(),
      lastRemoteJid: row.remoteJid,
    };
  }

  return byInstance;
}

export function getHistoryPersistence() {
  const messagesEnabled = process.env.SAVE_DATA_NEW_MESSAGE === 'true';
  return {
    mode: messagesEnabled ? 'database' as const : 'memory' as const,
    messagesEnabled,
    warning: messagesEnabled ? null : 'message_history_memory_only',
  };
}
