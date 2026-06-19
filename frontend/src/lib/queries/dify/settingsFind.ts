import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchDifySettingsResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["dify", "fetchDefaultSettings", JSON.stringify(params)];

export const fetchDefaultSettings = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/dify/fetchSettings/${instanceName}`, {
    headers: { apikey: token },
  });
  return response.data;
};

export const useFetchDefaultSettings = (props: UseQueryParams<FetchDifySettingsResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchDifySettingsResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchDefaultSettings({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
