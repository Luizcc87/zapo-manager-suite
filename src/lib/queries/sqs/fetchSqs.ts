import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FetchSqsResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token: string;
}

const queryKey = (params: Partial<IParams>) => ["sqs", "fetchSqs", JSON.stringify(params)];

export const fetchSqs = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/sqs/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFetchSqs = (props: UseQueryParams<FetchSqsResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FetchSqsResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, token }),
    queryFn: () => fetchSqs({ instanceName: instanceName!, token: token! }),
    enabled: !!instanceName,
  });
};
