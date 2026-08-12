import { ConversationStatus } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";
import { queryKey as statusQueryKey, ConversationStatusResponse } from "./findConversationStatus";

interface SetConversationStatusParams {
  instanceName: string;
  remoteJid: string;
  status: ConversationStatus;
  actor: { type: "human"; id: string };
  autoAssign?: boolean;
}

const setConversationStatus = async ({
  instanceName,
  remoteJid,
  status,
  actor,
  autoAssign,
}: SetConversationStatusParams) => {
  const response = await api.patch<ConversationStatusResponse>(
    `/chat/${instanceName}/${encodeURIComponent(remoteJid)}/status`,
    { status, actor, autoAssign },
  );
  return response.data;
};

export const useSetConversationStatus = () =>
  useManageMutation<ConversationStatusResponse, unknown, SetConversationStatusParams, unknown>(
    setConversationStatus,
    {
      invalidateKeys: [["chats", "status"], ["chats", "findChats"]],
    },
  );
