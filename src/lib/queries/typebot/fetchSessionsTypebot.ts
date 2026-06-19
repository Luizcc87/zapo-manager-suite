import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsTypebotResponse } from "./types";

interface IParams {
  instanceName: string | null;
  typebotId: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["typebot", "fetchSessions", JSON.stringify(params)];

export const fetchTypebotSessions = async ({ instanceName, typebotId, token }: IParams) => {
  const response = await api.get(`/typebot/fetchSessions/${typebotId}/${instanceName}`, { headers: { apiKey: token } });
  return response.data;
};

export const useFetchSessionsTypebot = (props: UseQueryParams<FetchSessionsTypebotResponse> & Partial<IParams>) => {
  const { instanceName, token, typebotId, ...rest } = props;
  return useQuery<FetchSessionsTypebotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      fetchTypebotSessions({
        instanceName: instanceName!,
        token,
        typebotId: typebotId!,
      }),
    enabled: !!instanceName && !!typebotId && (props.enabled ?? true),
  });
};
