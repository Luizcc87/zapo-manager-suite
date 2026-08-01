import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

type TelegramChannelConfig = {
  botToken?: string;
  chatId?: string;
};

type NotificationChannelInput = {
  type: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  events?: string[];
};

function redactTelegramConfig(config: any) {
  return {
    ...config,
    botToken: config?.botToken ? '********' : '',
  };
}

export function sanitizeNotificationChannel(channel: any) {
  const config = channel.type === 'telegram'
    ? redactTelegramConfig(channel.config || {})
    : channel.config || {};

  return {
    id: channel.id,
    instanceName: channel.instanceName,
    type: channel.type,
    name: channel.name,
    enabled: channel.enabled,
    config,
    events: Array.isArray(channel.events) ? channel.events : [],
    createdAt: channel.createdAt?.toISOString?.() ?? channel.createdAt,
    updatedAt: channel.updatedAt?.toISOString?.() ?? channel.updatedAt,
  };
}

export function validateNotificationChannelInput(input: NotificationChannelInput) {
  if (input.type !== 'telegram') {
    return 'Only telegram notification channels are supported initially';
  }

  const config = input.config || {};
  if (input.enabled !== false && (!config.botToken || !config.chatId)) {
    return 'telegram config requires botToken and chatId when enabled';
  }

  return null;
}

export async function listNotificationChannels(instanceName: string) {
  const channels = await prisma.notificationChannel.findMany({
    where: { instanceName },
    orderBy: { createdAt: 'desc' },
  });
  return channels.map(sanitizeNotificationChannel);
}

export async function upsertNotificationChannel(instanceName: string, channelId: string | undefined, input: NotificationChannelInput) {
  const error = validateNotificationChannelInput(input);
  if (error) throw new Error(error);

  const data = {
    instanceName,
    type: input.type,
    name: input.name || input.type,
    enabled: input.enabled ?? true,
    config: (input.config || {}) as Prisma.InputJsonValue,
    events: (input.events || []) as Prisma.InputJsonValue,
  };

  if (channelId) {
    const existing = await prisma.notificationChannel.findFirst({
      where: { id: channelId, instanceName },
    });
    if (!existing) throw new Error('Channel not found');

    const channel = await prisma.notificationChannel.update({
      where: { id: channelId },
      data,
    });
    return sanitizeNotificationChannel(channel);
  }

  const channel = await prisma.notificationChannel.create({ data });
  return sanitizeNotificationChannel(channel);
}

export async function deleteNotificationChannel(instanceName: string, channelId: string) {
  return prisma.notificationChannel.deleteMany({
    where: { id: channelId, instanceName },
  });
}

export async function getTelegramChannelForEvent(instanceName: string | undefined, eventType: string): Promise<TelegramChannelConfig | null> {
  if (!instanceName) return null;

  const channels = await prisma.notificationChannel.findMany({
    where: { instanceName, type: 'telegram', enabled: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const channel of channels) {
    const events = Array.isArray(channel.events) ? channel.events as string[] : [];
    if (events.length > 0 && !events.includes(eventType)) continue;
    const config = channel.config as TelegramChannelConfig;
    if (config?.botToken && config?.chatId) return config;
  }

  return null;
}
