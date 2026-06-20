import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";

export type ProxyStatusResponse = {
  enabled: boolean;
  connected: boolean;
  externalIp?: string;
  latencyMs?: number;
  proxyUrl?: string;
  protocol?: string;
  error?: string;
  details?: string;
};

const queryKey = (instanceName?: string | null) => ["proxy", "status", instanceName];

export const fetchProxyStatus = async (instanceName: string): Promise<ProxyStatusResponse> => {
  const response = await api.get(`/proxy/status/${instanceName}`);
  return response.data;
};

export const useFetchProxyStatus = (
  props: UseQueryParams<ProxyStatusResponse> & { instanceName?: string | null }
) => {
  const { instanceName, enabled, ...rest } = props;
  return useQuery<ProxyStatusResponse>({
    ...rest,
    queryKey: queryKey(instanceName),
    queryFn: () => fetchProxyStatus(instanceName!),
    enabled: !!instanceName && (enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
};
