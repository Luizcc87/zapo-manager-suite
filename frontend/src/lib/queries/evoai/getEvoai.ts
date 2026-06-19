import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetEvoaiResponse } from "./types";

interface IParams {
  evoaiId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["evoai", "getEvoai", JSON.stringify(params)];

export const getEvoai = async ({ evoaiId, instanceName }: IParams) => {
  const response = await api.get(`/evoai/fetch/${evoaiId}/${instanceName}`);
  return response.data;
};

export const useGetEvoai = (props: UseQueryParams<GetEvoaiResponse> & Partial<IParams>) => {
  const { evoaiId, instanceName, ...rest } = props;
  return useQuery<GetEvoaiResponse>({
    ...rest,
    queryKey: queryKey({ evoaiId, instanceName }),
    queryFn: () => getEvoai({ evoaiId: evoaiId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!evoaiId && (props.enabled ?? true),
  });
};
