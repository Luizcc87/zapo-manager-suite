import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchEvoaiRsponse } from "./types";

interface IParams {
  instanceName: string;
  token?: string;
}

const queryKey = (params: Partial<IParams>) => ["evoai", "fetchEvoai", JSON.stringify(params)];

export const fetchEvoai = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/evoai/find/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchEvoai = (props: UseQueryParams<FetchEvoaiRsponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchEvoaiRsponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchEvoai({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
