import React, { useState, createContext } from "react";

import { Message } from "@/types/evolution.types";

interface ReplyMessageContextData {
  replyingMessage: Message | null;
  setReplyingMessage: React.Dispatch<React.SetStateAction<Message | null>>;
}

const ReplyMessageContext = createContext({} as ReplyMessageContextData);

const ReplyMessageProvider = ({ children }: { children: React.ReactNode }) => {
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);

  return <ReplyMessageContext.Provider value={{ replyingMessage, setReplyingMessage }}>{children}</ReplyMessageContext.Provider>;
};

export { ReplyMessageContext, ReplyMessageProvider };
