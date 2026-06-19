import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetFlowiseResponse } from "./types";

interface IParams {
  instanceName: string;
  flowiseId: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["flowise", "getFlowise", JSON.stringify(params)];

export const getFlowise = async ({ instanceName, token, flowiseId }: IParams) => {
  const response = await api.get(`/flowise/fetch/${flowiseId}/${instanceName}`, { headers: { apiKey: token } });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useGetFlowise = (props: UseQueryParams<GetFlowiseResponse> & Partial<IParams>) => {
  const { instanceName, token, flowiseId, ...rest } = props;
  return useQuery<GetFlowiseResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      getFlowise({
        instanceName: instanceName!,
        token,
        flowiseId: flowiseId!,
      }),
    enabled: !!instanceName && !!flowiseId && (props.enabled ?? true),
  });
};
