/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImageIcon, VideoIcon, MicIcon, FileIcon, UserIcon, MapPinIcon } from "lucide-react";

import { useEmbedColors } from "@/contexts/EmbedColorsContext";

import { Chat, Message } from "@/types/evolution.types";

// Removed contact-colors import - using simple color logic

const calculateTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  const formattedMinutes = minutes < 10 ? `${minutes}` : minutes;
  const formattedSeconds = restSeconds < 10 ? `0${restSeconds}` : restSeconds;

  return `${formattedMinutes}:${formattedSeconds}`;
};

const maxLength = 50; // Define the character limit

// Componentes específicos para cada tipo de mensagem
const QuotedImageMessage = ({ imageMessage }: { imageMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <img src={imageMessage.mediaUrl} alt="Quoted message" width={100} height={100} />
      <ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
    <span className="inline-block max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm text-muted-foreground">{imageMessage.caption}</span>
  </div>
);

const QuotedVideoMessage = ({ videoMessage }: { videoMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <img src={videoMessage?.mediaUrl} alt="Quoted message" width={100} height={100} />
      <VideoIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
    <span className="inline-block max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm text-muted-foreground">{videoMessage.caption}</span>
  </div>
);

const QuotedAudioMessage = ({ audioMessage }: { audioMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{calculateTime(audioMessage.seconds)}</span>
      <MicIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
  </div>
);

const QuotedStickerMessage = ({ stickerMessage }: { stickerMessage: any }) => <img src={stickerMessage.mediaUrl} alt="Sticker" width={100} height={100} />;

const QuotedDocumentMessage = ({ documentMessage }: { documentMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{documentMessage.name}</span>
      <FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
  </div>
);

const QuotedDocumentWithCaptionMessage = ({ documentMessage }: { documentMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{documentMessage.name}</span>
      <FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
    <span className="inline-block max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm text-muted-foreground">{documentMessage.caption}</span>
  </div>
);

const QuotedContactMessage = ({ contactMessage }: { contactMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{contactMessage.displayName}</span>
      <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
  </div>
);

const QuoteLocationMessage = ({ locationMessage }: { locationMessage: any }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{locationMessage.name}</span>
      <MapPinIcon className="mr-2 h-4 w-4 text-muted-foreground" />
    </div>
    <span className="inline-block max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap text-sm text-muted-foreground">{locationMessage.address}</span>
  </div>
);

const QuotedTextMessage = ({ conversation }: { conversation: string }) => {
  return (
    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">{conversation.length > maxLength ? `${conversation.slice(0, maxLength)}...` : conversation}</span>
  );
};

const QuotedMessage = ({ message, quotedMessage, chat, onQuoteClick }: { message: Message; quotedMessage: Message; chat?: Chat; onQuoteClick?: () => void }) => {
  const { fromMeQuotedBubbleColor, fromOtherQuotedBubbleColor } = useEmbedColors();

  const mediaUrl = quotedMessage.message?.mediaUrl;

  const renderQuotedMessage = () => {
    if (quotedMessage.messageType === "imageMessage" && quotedMessage.message.imageMessage) {
      return (
        <QuotedImageMessage
          imageMessage={{
            caption: quotedMessage.message.imageMessage.caption,
            mediaUrl,
          }}
        />
      );
    } else if (quotedMessage.messageType === "videoMessage" && quotedMessage.message.videoMessage) {
      return (
        <QuotedVideoMessage
          videoMessage={{
            caption: quotedMessage.message.videoMessage.caption,
            mediaUrl,
          }}
        />
      );
    } else if (quotedMessage.messageType === "stickerMessage" && quotedMessage.message.stickerMessage) {
      return <QuotedStickerMessage stickerMessage={quotedMessage.message} />;
    } else if (quotedMessage.messageType === "audioMessage" && quotedMessage.message.audioMessage) {
      return (
        <QuotedAudioMessage
          audioMessage={{
            seconds: quotedMessage.message.audioMessage.seconds,
          }}
        />
      );
    } else if (quotedMessage.messageType === "documentMessage" && quotedMessage.message.documentMessage) {
      return (
        <QuotedDocumentMessage
          documentMessage={{
            name: quotedMessage.message.documentMessage.name,
            mediaUrl,
          }}
        />
      );
    } else if (quotedMessage.messageType === "documentWithCaptionMessage" && quotedMessage.message.documentWithCaptionMessage) {
      return (
        <QuotedDocumentWithCaptionMessage
          documentMessage={{
            name: quotedMessage.message.documentWithCaptionMessage.message.documentMessage.name,
            caption: quotedMessage.message.documentWithCaptionMessage.message.documentMessage.caption,
            mediaUrl,
          }}
        />
      );
    } else if (quotedMessage.messageType === "contactMessage" && quotedMessage.message.contactMessage) {
      return <QuotedContactMessage contactMessage={quotedMessage.message.contactMessage} />;
    } else if (quotedMessage.messageType === "locationMessage" && quotedMessage.message.locationMessage) {
      return <QuoteLocationMessage locationMessage={quotedMessage.message.locationMessage} />;
    } else if ((quotedMessage.messageType === "conversation" && quotedMessage.message.conversation) || quotedMessage.message.viewOnceMessage.message.interactiveMessage.body.text) {
      return <QuotedTextMessage conversation={quotedMessage.message.conversation || quotedMessage.message.viewOnceMessage.message.interactiveMessage.body.text} />;
    }
  };

  return (
    <div
      className={`relative -m-2 mb-2 flex min-w-[80px] cursor-pointer items-center overflow-hidden rounded-lg ${message.key.fromMe ? fromMeQuotedBubbleColor : fromOtherQuotedBubbleColor}`}
      onClick={onQuoteClick}
      role="button"
      tabIndex={0}>
      <div className={`absolute h-full w-1 rounded-l-lg ${quotedMessage.key.fromMe ? "bg-blue-700 dark:bg-blue-300" : "bg-blue-100"}`} />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2 pl-3">
        <span className={`break-words text-sm font-bold ${quotedMessage.key.fromMe ? "text-blue-700 dark:text-blue-300" : "text-blue-600"}`}>
          {quotedMessage.key.fromMe ? "Você" : (chat?.pushName ?? "Contact")}
        </span>
        {renderQuotedMessage()}
      </div>
    </div>
  );
};

export { QuotedMessage };
