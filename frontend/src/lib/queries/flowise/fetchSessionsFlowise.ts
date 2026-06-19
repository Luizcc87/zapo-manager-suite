import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsFlowiseResponse } from "./types";

interface IParams {
  instanceName: string | null;
  flowiseId: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["flowise", "fetchSessions", JSON.stringify(params)];

export const fetchFlowiseSessions = async ({ instanceName, flowiseId, token }: IParams) => {
  const response = await api.get(`/flowise/fetchSessions/${flowiseId}/${instanceName}`, { headers: { apiKey: token } });
  return response.data;
};

export const useFetchSessionsFlowise = (props: UseQueryParams<FetchSessionsFlowiseResponse> & Partial<IParams>) => {
  const { instanceName, token, flowiseId, ...rest } = props;
  return useQuery<FetchSessionsFlowiseResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      fetchFlowiseSessions({
        instanceName: instanceName!,
        token,
        flowiseId: flowiseId!,
      }),
    enabled: !!instanceName && !!flowiseId && (props.enabled ?? true),
  });
};
