import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetEvolutionBotResponse } from "./types";

interface IParams {
  instanceName: string;
  evolutionBotId: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["evolutionBot", "getEvolutionBot", JSON.stringify(params)];

export const getEvolutionBot = async ({ instanceName, token, evolutionBotId }: IParams) => {
  const response = await api.get(`/evolutionBot/fetch/${evolutionBotId}/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useGetEvolutionBot = (props: UseQueryParams<GetEvolutionBotResponse> & Partial<IParams>) => {
  const { instanceName, token, evolutionBotId, ...rest } = props;
  return useQuery<GetEvolutionBotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      getEvolutionBot({
        instanceName: instanceName!,
        token,
        evolutionBotId: evolutionBotId!,
      }),
    enabled: !!instanceName && !!evolutionBotId && (props.enabled ?? true),
  });
};
