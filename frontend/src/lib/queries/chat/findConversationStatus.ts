import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { ConversationStatus } from "@/types/evolution.types";

interface IParams {
  instanceName: string;
  remoteJid: string;
}

export type ConversationStatusResponse = {
  instanceName: string;
  remoteJid: string;
  status: ConversationStatus;
  assignedUserId: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
};

export const queryKey = (params: Partial<IParams>) => ["chats", "status", JSON.stringify(params)];

export const findConversationStatus = async ({ instanceName, remoteJid }: IParams) => {
  const response = await api.get<ConversationStatusResponse>(
    `/chat/${instanceName}/${encodeURIComponent(remoteJid)}/status`,
  );
  return response.data;
};

export const useFindConversationStatus = (
  props: UseQueryParams<ConversationStatusResponse> & Partial<IParams>,
) => {
  const { instanceName, remoteJid, ...rest } = props;
  return useQuery<ConversationStatusResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, remoteJid }),
    queryFn: () => findConversationStatus({ instanceName: instanceName!, remoteJid: remoteJid! }),
    enabled: !!instanceName && !!remoteJid,
  });
};
