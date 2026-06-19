import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchChatwoot } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["chatwoot", "fetchChatwoot", JSON.stringify(params)];

export const fetchChatwoot = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/chatwoot/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFetchChatwoot = (props: UseQueryParams<FetchChatwoot> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchChatwoot>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchChatwoot({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
