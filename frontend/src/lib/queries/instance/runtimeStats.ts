import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

export type InstanceRuntimeStats = {
  instanceName: string;
  connected: boolean;
  memoryChats: number;
  memoryMessages: number;
  databaseMessages: number;
  databaseEnabled: boolean;
};

type Params = {
  instanceName?: string;
  enabled?: boolean;
};

const queryKey = (instanceName?: string) => ["instance", "runtimeStats", instanceName];

export async function fetchInstanceRuntimeStats(instanceName: string): Promise<InstanceRuntimeStats> {
  const response = await api.get(`/instance/runtime-stats/${instanceName}`);
  return response.data;
}

export function useInstanceRuntimeStats({ instanceName, enabled = true }: Params) {
  return useQuery<InstanceRuntimeStats>({
    queryKey: queryKey(instanceName),
    queryFn: () => fetchInstanceRuntimeStats(instanceName!),
    enabled: enabled && !!instanceName,
    retry: false,
    staleTime: 15_000,
  });
}
