import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindDefaultSettingsEvolutionBot } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["evolutionBot", "fetchDefaultSettings", JSON.stringify(params)];

export const findDefaultSettingsEvolutionBot = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/evolutionBot/fetchSettings/${instanceName}`, { headers: { apiKey: token } });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useFindDefaultSettingsEvolutionBot = (props: UseQueryParams<FindDefaultSettingsEvolutionBot> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindDefaultSettingsEvolutionBot>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findDefaultSettingsEvolutionBot({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
