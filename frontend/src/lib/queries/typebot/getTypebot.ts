import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { GetTypebotResponse } from "./types";

interface IParams {
  instanceName: string;
  typebotId: string;
  token?: string | null;
}

const queryKey = (params: Partial<IParams>) => ["typebot", "getTypebot", JSON.stringify(params)];

export const getTypebot = async ({ instanceName, token, typebotId }: IParams) => {
  const response = await api.get(`/typebot/fetch/${typebotId}/${instanceName}`, {
    headers: { apiKey: token },
  });
  if (Array.isArray(response.data)) {
    return response.data[0];
  }
  return response.data;
};

export const useGetTypebot = (props: UseQueryParams<GetTypebotResponse> & Partial<IParams>) => {
  const { instanceName, token, typebotId, ...rest } = props;
  return useQuery<GetTypebotResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () =>
      getTypebot({
        instanceName: instanceName!,
        token,
        typebotId: typebotId!,
      }),
    enabled: !!instanceName && !!typebotId && (props.enabled ?? true),
  });
};
