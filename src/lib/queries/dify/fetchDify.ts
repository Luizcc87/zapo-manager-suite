import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchDifyRsponse } from "./types";

interface IParams {
  instanceName: string;
  token?: string;
}

const queryKey = (params: Partial<IParams>) => ["dify", "fetchDify", JSON.stringify(params)];

export const fetchDify = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/dify/find/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchDify = (props: UseQueryParams<FetchDifyRsponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchDifyRsponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchDify({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
