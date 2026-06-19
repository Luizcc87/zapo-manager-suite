import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindOpenaiResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["openai", "findOpenai", JSON.stringify(params)];

export const findOpenai = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/openai/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFindOpenai = (props: UseQueryParams<FindOpenaiResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindOpenaiResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findOpenai({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
