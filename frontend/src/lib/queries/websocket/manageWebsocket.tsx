import { Websocket } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface IParams {
  instanceName: string;
  token: string;
  data: Websocket;
}

const createWebsocket = async ({ instanceName, token, data }: IParams) => {
  const response = await api.post(`/websocket/set/${instanceName}`, { websocket: data }, { headers: { apikey: token } });
  return response.data;
};

export function useManageWebsocket() {
  const createWebsocketMutation = useManageMutation(createWebsocket, {
    invalidateKeys: [["websocket", "fetchWebsocket"]],
  });

  return {
    createWebsocket: createWebsocketMutation,
  };
}
