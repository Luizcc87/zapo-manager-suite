import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindDefaultSettingsTypebot } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["typebot", "fetchDefaultSettings", JSON.stringify(params)];

export const findDefaultSettingsTypebot = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/typebot/fetchSettings/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useFindDefaultSettingsTypebot = (props: UseQueryParams<FindDefaultSettingsTypebot> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindDefaultSettingsTypebot>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findDefaultSettingsTypebot({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
