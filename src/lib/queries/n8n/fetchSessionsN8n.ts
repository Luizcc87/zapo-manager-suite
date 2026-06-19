import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsN8nResponse } from "./types";

interface IParams {
  n8nId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["n8n", "fetchSessions", JSON.stringify(params)];

export const fetchSessionsN8n = async ({ n8nId, instanceName }: IParams) => {
  const response = await api.get(`/n8n/fetchSessions/${n8nId}/${instanceName}`);
  return response.data;
};

export const useFetchSessionsN8n = (props: UseQueryParams<FetchSessionsN8nResponse> & Partial<IParams>) => {
  const { n8nId, instanceName, ...rest } = props;
  return useQuery<FetchSessionsN8nResponse>({
    ...rest,
    queryKey: queryKey({ n8nId, instanceName }),
    queryFn: () => fetchSessionsN8n({ n8nId: n8nId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!n8nId && (props.enabled ?? true),
    staleTime: 1000 * 10, // 10 seconds
  });
};
