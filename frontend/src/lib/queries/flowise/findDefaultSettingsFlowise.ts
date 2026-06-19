import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindDefaultSettingsFlowiseResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["flowise", "fetchDefaultSettings", JSON.stringify(params)];

export const findDefaultSettingsFlowise = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/flowise/fetchSettings/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useFindDefaultSettingsFlowise = (props: UseQueryParams<FindDefaultSettingsFlowiseResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindDefaultSettingsFlowiseResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findDefaultSettingsFlowise({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
