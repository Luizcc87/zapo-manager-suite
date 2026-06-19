import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetModelsResponse } from "./types";

interface IParams {
  instanceName: string;
  openaiCredsId?: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "getModels", JSON.stringify(params)];

export const getModels = async ({ instanceName, openaiCredsId, token }: IParams) => {
  const params = openaiCredsId ? { openaiCredsId } : {};

  const response = await api.get(`/openai/getModels/${instanceName}`, {
    headers: { apiKey: token },
    params,
  });
  return response.data;
};

export const useGetModels = (props: UseQueryParams<GetModelsResponse> & Partial<IParams>) => {
  const { instanceName, openaiCredsId, token, ...rest } = props;
  return useQuery<GetModelsResponse>({
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
    ...rest,
    queryKey: queryKey({ instanceName, openaiCredsId }),
    queryFn: () =>
      getModels({
        instanceName: instanceName!,
        openaiCredsId,
        token,
      }),
    enabled: !!instanceName && !!openaiCredsId && (props.enabled ?? true),
  });
};
