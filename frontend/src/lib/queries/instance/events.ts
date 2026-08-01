import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";

export type InstanceEventSeverity = "info" | "warning" | "critical";

export type InstanceEvent = {
  id: string;
  instanceName: string;
  type: string;
  severity: InstanceEventSeverity;
  title: string;
  summary: string;
  details?: unknown;
  readAt: string | null;
  createdAt: string;
};

type EventsResponse = {
  instanceName: string;
  events: InstanceEvent[];
};

export type InstanceEventsSummary = {
  instanceName: string;
  days: number;
  since: string;
  total: number;
  unreadCount: number;
  severity: {
    info: number;
    warning: number;
    critical: number;
  };
  topTypes: Array<{ type: string; count: number }>;
  lastCritical: {
    id: string;
    type: string;
    title: string;
    summary: string;
    createdAt: string;
    readAt: string | null;
  } | null;
};

type SendInstanceEventsSummaryResponse = {
  status: "sent";
  instanceName: string;
  days: number;
};

const queryKey = (instanceName?: string) => ["instance", "events", instanceName];
const summaryQueryKey = (instanceName?: string) => ["instance", "eventsSummary", instanceName];

export async function fetchInstanceEvents(instanceName: string, limit = 10): Promise<EventsResponse> {
  const response = await api.get(`/instance/events/${instanceName}?limit=${limit}`);
  return response.data;
}

export function useInstanceEvents(instanceName?: string) {
  return useQuery<EventsResponse>({
    queryKey: queryKey(instanceName),
    queryFn: () => fetchInstanceEvents(instanceName!),
    enabled: !!instanceName,
    retry: false,
    staleTime: 15_000,
  });
}

export function useInstanceEventsSummary(instanceName?: string) {
  return useQuery<InstanceEventsSummary>({
    queryKey: summaryQueryKey(instanceName),
    queryFn: async () => {
      const response = await api.get(`/instance/events-summary/${instanceName}?days=7`);
      return response.data;
    },
    enabled: !!instanceName,
    retry: false,
    staleTime: 15_000,
  });
}

export function useMarkInstanceEventRead(instanceName?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      await api.post(`/instance/events/${instanceName}/${eventId}/read`);
      return eventId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(instanceName) });
      queryClient.invalidateQueries({ queryKey: summaryQueryKey(instanceName) });
    },
  });
}

export function useSendInstanceEventsSummary(instanceName?: string) {
  return useMutation<SendInstanceEventsSummaryResponse, Error, number>({
    mutationFn: async (days = 7) => {
      const response = await api.post(`/instance/events-summary/${instanceName}/send`, { days });
      return response.data as SendInstanceEventsSummaryResponse;
    },
  });
}
