import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindOpenaiCredsResponse } from "./types";

interface IParams {
  instanceName: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "findOpenaiCreds", JSON.stringify(params)];

export const findOpenaiCreds = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/openai/creds/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFindOpenaiCreds = (props: UseQueryParams<FindOpenaiCredsResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindOpenaiCredsResponse>({
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      findOpenaiCreds({
        instanceName: instanceName!,
        token,
      }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
