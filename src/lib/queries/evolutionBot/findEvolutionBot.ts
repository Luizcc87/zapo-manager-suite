import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindEvolutionBotResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["evolutionBot", "findEvolutionBot", JSON.stringify(params)];

export const findEvolutionBot = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/evolutionBot/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFindEvolutionBot = (props: UseQueryParams<FindEvolutionBotResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindEvolutionBotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findEvolutionBot({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
