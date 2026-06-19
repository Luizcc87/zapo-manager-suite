import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchWebsocketResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["websocket", "fetchWebsocket", JSON.stringify(params)];

export const fetchWebsocket = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/websocket/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFetchWebsocket = (props: UseQueryParams<FetchWebsocketResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchWebsocketResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchWebsocket({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
