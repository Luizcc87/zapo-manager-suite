import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchN8nSettingsResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["n8n", "fetchDefaultSettings", JSON.stringify(params)];

export const fetchDefaultSettings = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/n8n/fetchSettings/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchDefaultSettings = (props: UseQueryParams<FetchN8nSettingsResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchN8nSettingsResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchDefaultSettings({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
