import { getTelegramChannelForEvent } from './notificationChannels';

type TelegramSeverity = 'info' | 'warning' | 'critical';

type TelegramAlertInput = {
  instanceName?: string;
  type: string;
  severity: TelegramSeverity;
  title: string;
  summary: string;
  dedupeKey?: string;
};

type TelegramCredentials = {
  botToken: string;
  chatId: string;
};

type TelegramChannelResolver = (instanceName: string | undefined, eventType: string) => Promise<TelegramCredentials | null>;

const defaultTelegramChannelResolver: TelegramChannelResolver = async (instanceName, eventType) => {
  const channel = await getTelegramChannelForEvent(instanceName, eventType);
  if (!channel?.botToken || !channel?.chatId) return null;
  return { botToken: channel.botToken, chatId: channel.chatId };
};

let telegramChannelResolver: TelegramChannelResolver = defaultTelegramChannelResolver;

const dedupeCache = new Map<string, number>();
const DEFAULT_DEDUPE_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;

export function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isTelegramAlertsEnabled() {
  return process.env.TELEGRAM_ALERTS_ENABLED === 'true' && !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

export function isTelegramConnectionAlertsEnabled() {
  return process.env.TELEGRAM_ALERT_CONNECTION_EVENTS === 'true';
}

function getDedupeMs() {
  const raw = Number(process.env.TELEGRAM_ALERT_DEDUPE_SECONDS);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_DEDUPE_MS;
  return raw * 1000;
}

export function resetTelegramAlertDedupe() {
  dedupeCache.clear();
}

export function setTelegramChannelResolverForTests(resolver?: TelegramChannelResolver) {
  telegramChannelResolver = resolver || defaultTelegramChannelResolver;
}

export function shouldSendTelegramAlert(key: string, now = Date.now()) {
  const previous = dedupeCache.get(key);
  if (previous && now - previous < getDedupeMs()) return false;
  dedupeCache.set(key, now);
  return true;
}

async function resolveTelegramCredentials(input: TelegramAlertInput): Promise<TelegramCredentials | null> {
  const channel = await telegramChannelResolver(input.instanceName, input.type).catch(() => null);
  if (channel?.botToken && channel?.chatId) {
    return { botToken: channel.botToken, chatId: channel.chatId };
  }

  if (!isTelegramAlertsEnabled()) return null;
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  };
}

export async function sendTelegramAlert(input: TelegramAlertInput): Promise<boolean> {
  const credentials = await resolveTelegramCredentials(input);
  if (!credentials) return false;

  const key = input.dedupeKey || `${input.instanceName || 'global'}:${input.type}:${input.severity}`;
  if (!shouldSendTelegramAlert(key)) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const lines = [
    `<b>${escapeTelegramHtml(input.title)}</b>`,
    `Severidade: ${escapeTelegramHtml(input.severity)}`,
    input.instanceName ? `Instancia: ${escapeTelegramHtml(input.instanceName)}` : null,
    `Tipo: ${escapeTelegramHtml(input.type)}`,
    '',
    escapeTelegramHtml(input.summary),
  ].filter(Boolean);

  try {
    const response = await fetch(`https://api.telegram.org/bot${credentials.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: credentials.chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[TelegramAlerts] Falha ao enviar alerta Telegram: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[TelegramAlerts] Falha ao enviar alerta Telegram:`, err.name === 'AbortError' ? 'timeout' : err.message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
