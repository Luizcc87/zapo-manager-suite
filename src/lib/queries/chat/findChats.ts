import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindChatsResponse } from "./types";

interface IParams {
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["chats", "findChats", JSON.stringify(params)];

export const findChats = async ({ instanceName }: IParams) => {
  const response = await api.post(`/chat/findChats/${instanceName}`, {
    where: {},
  });
  return response.data;
};

export const useFindChats = (props: UseQueryParams<FindChatsResponse> & Partial<IParams>) => {
  const { instanceName, ...rest } = props;
  return useQuery<FindChatsResponse>({
    ...rest,
    queryKey: queryKey({ instanceName }),
    queryFn: () => findChats({ instanceName: instanceName! }),
    enabled: !!instanceName,
  });
};
