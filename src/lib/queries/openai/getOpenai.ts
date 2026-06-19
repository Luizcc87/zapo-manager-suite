import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetOpenaiResponse } from "./types";

interface IParams {
  instanceName: string;
  openaiId: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "getOpenai", JSON.stringify(params)];

export const getOpenai = async ({ instanceName, token, openaiId }: IParams) => {
  const response = await api.get(`/openai/fetch/${openaiId}/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useGetOpenai = (props: UseQueryParams<GetOpenaiResponse> & Partial<IParams>) => {
  const { instanceName, token, openaiId, ...rest } = props;
  return useQuery<GetOpenaiResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      getOpenai({
        instanceName: instanceName!,
        token,
        openaiId: openaiId!,
      }),
    enabled: !!instanceName && !!openaiId && (props.enabled ?? true),
  });
};
