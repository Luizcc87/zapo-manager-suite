import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSessionsEvoaiResponse } from "./types";

interface IParams {
  evoaiId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["evoai", "fetchSessions", JSON.stringify(params)];

export const fetchSessionsEvoai = async ({ evoaiId, instanceName }: IParams) => {
  const response = await api.get(`/evoai/fetchSessions/${evoaiId}/${instanceName}`);
  return response.data;
};

export const useFetchSessionsEvoai = (props: UseQueryParams<FetchSessionsEvoaiResponse> & Partial<IParams>) => {
  const { evoaiId, instanceName, ...rest } = props;
  return useQuery<FetchSessionsEvoaiResponse>({
    ...rest,
    queryKey: queryKey({ evoaiId, instanceName }),
    queryFn: () => fetchSessionsEvoai({ evoaiId: evoaiId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!evoaiId && (props.enabled ?? true),
    staleTime: 1000 * 10, // 10 seconds
  });
};
