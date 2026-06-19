import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsEvolutionBotResponse } from "./types";

interface IParams {
  instanceName: string | null;
  evolutionBotId: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["evolutionBot", "fetchSessions", JSON.stringify(params)];

export const fetchEvolutionBotSessions = async ({ instanceName, evolutionBotId, token }: IParams) => {
  const response = await api.get(`/evolutionBot/fetchSessions/${evolutionBotId}/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFetchSessionsEvolutionBot = (props: UseQueryParams<FetchSessionsEvolutionBotResponse> & Partial<IParams>) => {
  const { instanceName, token, evolutionBotId, ...rest } = props;
  return useQuery<FetchSessionsEvolutionBotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      fetchEvolutionBotSessions({
        instanceName: instanceName!,
        token,
        evolutionBotId: evolutionBotId!,
      }),
    enabled: !!instanceName && !!evolutionBotId && (props.enabled ?? true),
  });
};
