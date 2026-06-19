import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindTypebotResponse } from "./types";

interface IParams {
  instanceName: string | null;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["typebot", "findTypebot", JSON.stringify(params)];

export const findTypebot = async ({ instanceName, token }: IParams) => {
  const response = await api.get(`/typebot/find/${instanceName}`, {
    headers: { apiKey: token },
  });
  return response.data;
};

export const useFindTypebot = (props: UseQueryParams<FindTypebotResponse> & Partial<IParams>) => {
  const { instanceName, token, ...rest } = props;
  return useQuery<FindTypebotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findTypebot({ instanceName: instanceName!, token }),
    enabled: !!instanceName && (props.enabled ?? true),
  });
};
