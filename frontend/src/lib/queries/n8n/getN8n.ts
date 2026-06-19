import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetN8nResponse } from "./types";

interface IParams {
  n8nId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["n8n", "getN8n", JSON.stringify(params)];

export const getN8n = async ({ n8nId, instanceName }: IParams) => {
  const response = await api.get(`/n8n/fetch/${n8nId}/${instanceName}`);
  return response.data;
};

export const useGetN8n = (props: UseQueryParams<GetN8nResponse> & Partial<IParams>) => {
  const { n8nId, instanceName, ...rest } = props;
  return useQuery<GetN8nResponse>({
    ...rest,
    queryKey: queryKey({ n8nId, instanceName }),
    queryFn: () => getN8n({ n8nId: n8nId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!n8nId && (props.enabled ?? true),
  });
};
