import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchEvoaiSettingsResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["evoai", "fetchDefaultSettings", JSON.stringify(params)];

export const fetchDefaultSettings = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/evoai/fetchSettings/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchDefaultSettings = (props: UseQueryParams<FetchEvoaiSettingsResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchEvoaiSettingsResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchDefaultSettings({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
