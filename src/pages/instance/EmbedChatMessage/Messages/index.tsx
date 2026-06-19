import { useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useEmbedColors } from "@/contexts/EmbedColorsContext";
import { useFindMessages } from "@/lib/queries/chat/findMessages";
import { Instance, Message } from "@/types/evolution.types";
import { MessageContent } from "./message-content";

interface MessagesProps {
  remoteJid: string;
  instance: Instance;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}

const Messages = ({ remoteJid, instance, messages, setMessages }: MessagesProps) => {
  const { backgroundColor } = useEmbedColors();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const containerStyle = { backgroundColor };

  const {
    data: fetchedMessages,
    isLoading,
    error,
  } = useFindMessages({
    instanceName: instance?.name,
    remoteJid,
    enabled: !!instance?.name && !!remoteJid,
  });

  // Update messages when new data is fetched
  useEffect(() => {
    if (fetchedMessages) {
      setMessages(fetchedMessages);
    }
  }, [fetchedMessages, setMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  if (!instance?.name) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">Error loading messages</p>
      </div>
    );
  }

  return (
    <div ref={messagesContainerRef} className="custom-scrollbar relative flex-grow overflow-y-auto" style={containerStyle}>
      <div className="relative mx-auto box-border flex w-full max-w-[64rem] flex-col gap-6 bg-transparent p-[0.375rem_1rem_0_1rem]">
        {messages.map((message) => (
          <MessageContent key={message.key.id} message={message} fromMe={message.key.fromMe} />
        ))}
      </div>
    </div>
  );
};

export { Messages };
