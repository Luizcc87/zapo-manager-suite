import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsDifyResponse } from "./types";

interface IParams {
  difyId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["dify", "fetchSessions", JSON.stringify(params)];

export const fetchSessions = async ({ difyId, instanceName }: IParams) => {
  const response = await api.get(`/dify/fetchSessions/${difyId}/${instanceName}`);
  return response.data;
};

export const useFetchSessionsDify = (props: UseQueryParams<FetchSessionsDifyResponse> & Partial<IParams>) => {
  const { difyId, instanceName, ...rest } = props;
  return useQuery<FetchSessionsDifyResponse>({
    ...rest,
    queryKey: queryKey({ difyId, instanceName }),
    queryFn: () => fetchSessions({ difyId: difyId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!difyId && (props.enabled ?? true),
    staleTime: 1000 * 10, // 10 seconds
  });
};
