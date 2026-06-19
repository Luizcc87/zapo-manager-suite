import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchN8nRsponse } from "./types";

interface IParams {
  instanceName: string;
  token?: string;
}

const queryKey = (params: Partial<IParams>) => ["n8n", "fetchN8n", JSON.stringify(params)];

export const fetchN8n = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/n8n/find/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchN8n = (props: UseQueryParams<FetchN8nRsponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchN8nRsponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchN8n({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
