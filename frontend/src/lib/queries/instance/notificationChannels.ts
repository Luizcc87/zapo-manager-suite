import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";

export type NotificationChannel = {
  id: string;
  instanceName: string;
  type: "telegram";
  name: string;
  enabled: boolean;
  config: {
    botToken?: string;
    chatId?: string;
  };
  events: string[];
  createdAt: string;
  updatedAt: string;
};

type ChannelsResponse = {
  instanceName: string;
  channels: NotificationChannel[];
};

type TelegramChannelPayload = {
  name: string;
  enabled: boolean;
  config: {
    botToken: string;
    chatId: string;
  };
  events: string[];
};

const queryKey = (instanceName?: string) => ["instance", "notificationChannels", instanceName];

export function useNotificationChannels(instanceName?: string) {
  return useQuery<ChannelsResponse>({
    queryKey: queryKey(instanceName),
    queryFn: async () => {
      const response = await api.get(`/notification/channels/${instanceName}`);
      return response.data;
    },
    enabled: !!instanceName,
    retry: false,
    staleTime: 15_000,
  });
}

export function useSaveTelegramChannel(instanceName?: string, channelId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TelegramChannelPayload) => {
      const endpoint = channelId
        ? `/notification/channels/${instanceName}/${channelId}`
        : `/notification/channels/${instanceName}`;
      const response = await api.post(endpoint, {
        type: "telegram",
        ...payload,
      });
      return response.data as NotificationChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(instanceName) });
    },
  });
}

export function useDeleteNotificationChannel(instanceName?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/notification/channels/${instanceName}/${channelId}`);
      return channelId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(instanceName) });
    },
  });
}

export function useTestTelegramChannel(instanceName?: string) {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const response = await api.post(`/notification/channels/${instanceName}/${channelId}/test`);
      return response.data as { status: "sent"; channelId: string };
    },
  });
}
