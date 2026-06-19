import { Check } from "lucide-react";
// Removed moment import - using native Date methods instead

// Removed tooltip import - not available in project

import { Message, Chat } from "@/types/evolution.types";

// Removed contact-colors import - using simple color logic

import { MessageBubble } from "./message-bubble";
import { MessageRenderer } from "./message-renderer";
import { QuotedMessage } from "./quoted-message";

// Adicione ao tipo Message (você pode fazer isso no arquivo de tipos)
interface Reaction {
  emoji: string;
  sender: string;
  messageId: string;
}

interface MessageContentProps {
  message: Message & { reactions?: Reaction[] };
  quotedMessage?: Message;
  chat?: Chat;
  fromMe: boolean;
}

export function MessageContent({ message, quotedMessage, chat, fromMe, onQuoteClick }: MessageContentProps & { onQuoteClick?: (messageId: string) => void }) {
  // Check if message is complete with required properties
  // const isValidMessage = message && message.key && (message.id || message.key.id);

  // Verifica se a mensagem foi lida
  const checkDeliveryStatus = () => {
    // const { messageUpdate } = message; // TODO: Add messageUpdate to Message type

    // TODO: Implement status check when messageUpdate is added to Message type
    return <Check className="h-4 w-4" />;
  };

  // Renderiza o nome do participante
  const renderParticipantName = () => {
    // Se o participante não existe ou a mensagem é minha, não renderiza o nome
    // Group messages not supported yet
    return null;

    return <span className="text-xs font-bold text-blue-600">{"Group Member"}</span>;
  };

  /** TODO: Alterar o Z-INDEX do tooltip */
  const renderReactions = () => {
    // Se não houver reações, retorna null
    if (!message.reactions?.length) return null;

    // Agrupa as reações por emoji
    const groupedReactions = message.reactions.reduce(
      (acc, reaction) => {
        // Inicializa o acumulador para este emoji se não existir
        acc[reaction.emoji] = acc[reaction.emoji] || {
          emoji: reaction.emoji,
          senders: [],
        };

        // Tenta extrair o nome do remetente
        const senderName = reaction.sender.includes("@g.us") ? "You" || reaction.sender.split("@")[0] : reaction.sender.split("@")[0];

        // Adiciona o remetente à lista de senders deste emoji
        acc[reaction.emoji].senders.push(senderName);
        return acc;
      },
      {} as Record<string, { emoji: string; senders: string[] }>,
    );

    // Limita a exibição a 3 reações
    const limitedReactions = Object.values(groupedReactions).slice(0, 3);

    return (
      <div className={`absolute -bottom-4 ${fromMe ? "right-0" : "left-0"} flex rounded-full bg-gray-100 px-1 dark:bg-gray-900`}>
        {/* Renderiza cada emoji */}
        {limitedReactions.map((reaction) => (
          <div key={reaction.emoji} className="flex items-center">
            {reaction.emoji}
          </div>
        ))}
        {/* Mostra o contador se houver mais de uma reação */}
        {message.reactions.length > 1 && <span className="ml-1 flex items-center pr-2 text-xs text-muted-foreground">{message.reactions.length}</span>}
      </div>
    );
  };

  // Handle timestamp issues and show date + time
  const renderTimestamp = () => {
    let formattedTime;
    let messageDate;

    try {
      // Try to format timestamp based on its type and format
      if (!message.messageTimestamp) {
        formattedTime = "No time";
      }
      // Handle case where timestamp is an object
      else if (typeof message.messageTimestamp === "object") {
        // Try common timestamp fields that might be in the object
        const possibleTimestamps = [
          (message.messageTimestamp as any).low,
          (message.messageTimestamp as any).seconds,
          (message.messageTimestamp as any).timestamp,
          (message.messageTimestamp as any).time,
          (message.messageTimestamp as any).value,
        ];

        // Find the first valid timestamp in the object
        const timestamp = possibleTimestamps.find((val) => typeof val === "number" && !isNaN(val));

        if (timestamp) {
          // Use the extracted timestamp value
          messageDate = new Date(timestamp * 1000);
          formattedTime = new Date(timestamp * 1000).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else {
          // If we have the full object printed in logs, manually extract using keys we see
          formattedTime = "Time obj";
        }
      }
      // Handle number or numeric string
      else if (!isNaN(Number(message.messageTimestamp))) {
        const timestampNum = Number(message.messageTimestamp);

        // Check if it's a Unix timestamp (seconds since epoch) or milliseconds
        if (timestampNum > 1000000000000) {
          // Likely milliseconds format (13 digits), convert to seconds
          messageDate = new Date(timestampNum);
          formattedTime = new Date(timestampNum).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else {
          // Likely seconds format (10 digits)
          messageDate = new Date(timestampNum * 1000);
          formattedTime = new Date(timestampNum * 1000).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      }
      // If it's an ISO date string format
      else if (typeof message.messageTimestamp === "string" && message.messageTimestamp.includes("T")) {
        messageDate = new Date(message.messageTimestamp);
        formattedTime = new Date(message.messageTimestamp as string).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      // If all else fails
      else {
        formattedTime = "Invalid format";
      }

      // Add date prefix for WhatsApp style
      if (messageDate) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Check if it's today
        if (messageDate.toDateString() === today.toDateString()) {
          formattedTime = `Hoje ${formattedTime}`;
        }
        // Check if it's yesterday
        else if (messageDate.toDateString() === yesterday.toDateString()) {
          formattedTime = `Ontem ${formattedTime}`;
        }
        // Check if it's within the last week
        else {
          const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 7) {
            const weekday = messageDate.toLocaleDateString("pt-BR", { weekday: "long" });
            const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
            formattedTime = `${capitalizedWeekday} ${formattedTime}`;
          } else {
            // For older dates, show the full date
            const fullDate = messageDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            formattedTime = `${fullDate} ${formattedTime}`;
          }
        }
      }
    } catch (error) {
      formattedTime = "Error";
    }

    return formattedTime;
  };

  return (
    <MessageBubble.Content fromMe={fromMe}>
      {renderReactions()}
      {quotedMessage && <QuotedMessage message={message} quotedMessage={quotedMessage} chat={chat} onQuoteClick={() => onQuoteClick?.(quotedMessage.key.id)} />}

      {renderParticipantName()}

      <div className="flex flex-col">
        <MessageRenderer message={message} fromMe={fromMe} />

        <MessageBubble.Footer fromMe={fromMe}>
          {renderTimestamp()}
          {fromMe && checkDeliveryStatus()}
        </MessageBubble.Footer>
      </div>
    </MessageBubble.Content>
  );
}
