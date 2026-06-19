import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetDifyResponse } from "./types";

interface IParams {
  difyId: string;
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["dify", "getDify", JSON.stringify(params)];

export const getDify = async ({ difyId, instanceName }: IParams) => {
  const response = await api.get(`/dify/fetch/${difyId}/${instanceName}`);
  return response.data;
};

export const useGetDify = (props: UseQueryParams<GetDifyResponse> & Partial<IParams>) => {
  const { difyId, instanceName, ...rest } = props;
  return useQuery<GetDifyResponse>({
    ...rest,
    queryKey: queryKey({ difyId, instanceName }),
    queryFn: () => getDify({ difyId: difyId!, instanceName: instanceName! }),
    enabled: !!instanceName && !!difyId && (props.enabled ?? true),
  });
};
