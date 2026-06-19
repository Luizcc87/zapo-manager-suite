import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindDefaultSettingsOpenaiResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "fetchDefaultSettings", JSON.stringify(params)];

export const findDefaultSettingsOpenai = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/openai/fetchSettings/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useFindDefaultSettingsOpenai = (props: UseQueryParams<FindDefaultSettingsOpenaiResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindDefaultSettingsOpenaiResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findDefaultSettingsOpenai({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
