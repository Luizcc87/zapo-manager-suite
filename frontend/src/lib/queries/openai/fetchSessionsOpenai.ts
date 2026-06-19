import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsOpenaiResponse } from "./types";

interface IParams {
  instanceName: string | null;
  openaiId: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "fetchSessions", JSON.stringify(params)];

export const fetchSessionsOpenai = async ({ instanceName, openaiId, token }: IParams) => {
  const response = await api.get(`/openai/fetchSessions/${openaiId}/${instanceName}`, { headers: { apiKey: token } });
  return response.data;
};

export const useFetchSessionsOpenai = (props: UseQueryParams<FetchSessionsOpenaiResponse> & Partial<IParams>) => {
  const { instanceName, token, openaiId, ...rest } = props;
  return useQuery<FetchSessionsOpenaiResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      fetchSessionsOpenai({
        instanceName: instanceName!,
        token,
        openaiId: openaiId!,
      }),
    enabled: !!instanceName && !!openaiId && (props.enabled ?? true),
  });
};
