import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchRabbitmqResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["rabbitmq", "fetchRabbitmq", JSON.stringify(params)];

export const fetchRabbitmq = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/rabbitmq/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFetchRabbitmq = (props: UseQueryParams<FetchRabbitmqResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchRabbitmqResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchRabbitmq({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
