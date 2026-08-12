import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { UseQueryParams } from "../types";
import { FindMessagesResponse } from "./types";
import { Message, Reaction } from "@/types/evolution.types";

interface IParams {
  instanceName: string;
  remoteJid: string;
}

const queryKey = (params: Partial<IParams>) => ["chats", "findMessages", JSON.stringify(params)];

/**
 * Agrupa reactionMessage e protocolMessage(REVOKE) recebidos como
 * metadados anexados à mensagem-alvo (por key.id), em vez de renderizá-los
 * como bolhas próprias na timeline.
 */
function groupReactionsAndRevokes(rawMessages: Message[]): (Message & { reactions?: Reaction[]; isDeleted?: boolean })[] {
  const reactionsByTargetId = new Map<string, Reaction[]>();
  const deletedIds = new Set<string>();

  for (const msg of rawMessages) {
    if (msg.messageType === "reactionMessage" && msg.message?.reactionMessage) {
      const targetId = msg.message.reactionMessage.key?.id;
      const emoji = msg.message.reactionMessage.text;
      if (!targetId) continue;
      const list = reactionsByTargetId.get(targetId) ?? [];
      const senderId = msg.key.fromMe ? "me" : (msg.key.participant ?? msg.key.remoteJid);
      // Remove reação anterior do mesmo sender pra esse alvo (WhatsApp permite 1 reação por pessoa/mensagem)
      const filtered = list.filter((r) => r.sender !== senderId);
      if (emoji) {
        filtered.push({ emoji, sender: senderId, messageId: msg.key.id });
      }
      reactionsByTargetId.set(targetId, filtered);
      continue;
    }

    if (msg.messageType === "protocolMessage" && msg.message?.protocolMessage?.type === "REVOKE") {
      const targetId = msg.message.protocolMessage.key?.id;
      if (targetId) deletedIds.add(targetId);
      continue;
    }
  }

  return rawMessages
    .filter((msg) => msg.messageType !== "reactionMessage" && msg.messageType !== "protocolMessage")
    .map((msg) => ({
      ...msg,
      reactions: reactionsByTargetId.get(msg.key.id),
      isDeleted: deletedIds.has(msg.key.id),
    }));
}

export const findMessages = async ({ instanceName, remoteJid }: IParams) => {
  const response = await api.post(`/chat/findMessages/${instanceName}`, {
    where: { key: { remoteJid } },
  });
  const records = response.data?.messages?.records ?? response.data;
  return groupReactionsAndRevokes(records);
};

export const useFindMessages = (props: UseQueryParams<FindMessagesResponse> & Partial<IParams>) => {
  const { instanceName, remoteJid, ...rest } = props;
  return useQuery<FindMessagesResponse>({
    ...rest,
    queryKey: queryKey({ instanceName, remoteJid }),
    queryFn: () => findMessages({ instanceName: instanceName!, remoteJid: remoteJid! }),
    enabled: !!instanceName && !!remoteJid,
  });
};
