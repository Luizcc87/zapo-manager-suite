import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindFlowiseResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["flowise", "findFlowise", JSON.stringify(params)];

export const findFlowise = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/flowise/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFindFlowise = (props: UseQueryParams<FindFlowiseResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindFlowiseResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findFlowise({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
