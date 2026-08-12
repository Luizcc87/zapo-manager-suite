import { Copy, CornerUpLeft, SmilePlus, Send, Trash2, User, X } from "lucide-react";
import { Dispatch, memo, ReactNode, RefObject, SetStateAction, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@evoapi/design-system/avatar";
import { Button } from "@evoapi/design-system/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { useInstance } from "@/contexts/InstanceContext";

import { useFindChat } from "@/lib/queries/chat/findChat";
import { groupReactionsAndRevokes, useFindMessages } from "@/lib/queries/chat/findMessages";
import { useDeleteMessageForMe, useRevokeMessage, useSendMessage, useSendMedia, useSendReaction } from "@/lib/queries/chat/sendMessage";
import { getChatMediaKind, MEDIA_CAPTION_MAX } from "@/lib/chat/media-support";
import { getToken, TOKEN_ID } from "@/lib/queries/token";

import { Message, Reaction } from "@/types/evolution.types";

import { connectSocket } from "@/services/websocket/socket";
import { toast } from "react-toastify";

// Import components from EmbedChatMessage for attachment functionality
import { MediaOptions } from "../EmbedChatMessage/InputMessage/media-options";
import { SelectedMedia } from "../EmbedChatMessage/InputMessage/selected-media";
import { ConversationStatusBadge } from "./conversation-status";

type MessagesProps = {
  textareaRef: RefObject<HTMLTextAreaElement>;
  handleTextareaChange: () => void;
  textareaHeight: string;
  lastMessageRef: RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
};

// Utility function to format dates like WhatsApp
type TFn = (key: string, opts?: Record<string, unknown>) => string;

const formatDateSeparator = (date: Date, t: TFn, locale: string): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date);

  if (messageDate.toDateString() === today.toDateString()) {
    return t("chat.date.today", { defaultValue: "Hoje" });
  }

  if (messageDate.toDateString() === yesterday.toDateString()) {
    return t("chat.date.yesterday", { defaultValue: "Ontem" });
  }

  const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return messageDate.toLocaleDateString(locale, { weekday: "long" });
  }

  return messageDate.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Utility function to get timestamp from message
const getMessageTimestamp = (message: Message): Date => {
  try {
    if (!message.messageTimestamp) {
      return new Date();
    }

    // Handle case where timestamp is an object
    if (typeof message.messageTimestamp === "object") {
      const possibleTimestamps = [
        (message.messageTimestamp as any).low,
        (message.messageTimestamp as any).seconds,
        (message.messageTimestamp as any).timestamp,
        (message.messageTimestamp as any).time,
        (message.messageTimestamp as any).value,
      ];

      const timestamp = possibleTimestamps.find((val) => typeof val === "number" && !isNaN(val)) || Date.now() / 1000;

      return new Date(timestamp * 1000);
    }
    // Handle number or numeric string
    else if (!isNaN(Number(message.messageTimestamp))) {
      const timestamp = Number(message.messageTimestamp);

      // Check if it's milliseconds format (13 digits) or seconds format (10 digits)
      if (timestamp > 1000000000000) {
        return new Date(timestamp);
      } else {
        return new Date(timestamp * 1000);
      }
    }
    // If it's an ISO date string format
    else if (typeof message.messageTimestamp === "string" && message.messageTimestamp.includes("T")) {
      return new Date(message.messageTimestamp);
    }

    return new Date();
  } catch (error) {
    return new Date();
  }
};

// Component for date separator
const DateSeparator = ({ date }: { date: string }) => (
  <div className="flex items-center justify-center py-3">
    <div className="rounded-full bg-muted/50 px-3 py-1">
      <span className="text-xs font-medium text-muted-foreground">{date}</span>
    </div>
  </div>
);

const formatMessageTime = (date: Date, locale: string): string =>
  date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

// WhatsApp-like deterministic color palette per sender
const SENDER_COLORS = [
  "#e91e63", "#9c27b0", "#3f51b5", "#2196f3", "#00bcd4",
  "#009688", "#4caf50", "#ff9800", "#f44336", "#795548",
];

const getSenderColor = (key: string): string => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type DeleteIntent = "me" | "everyone";

type MessageActionsProps = {
  message: Message;
  canDeleteForEveryone: boolean;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
  children: ReactNode;
};

const MessageActions = ({ message, canDeleteForEveryone, onReact, onReply, onDeleteForMe, onDeleteForEveryone, children }: MessageActionsProps) => {
  const [touchOpen, setTouchOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const fromMe = message.key.fromMe;
  const toolbarOpen = touchOpen || reactionOpen || menuOpen || !!deleteIntent;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setTouchOpen(true);
  };

  const handleReact = (emoji: string) => {
    onReact(message, emoji);
    setReactionOpen(false);
    setTouchOpen(false);
  };

  const handleDeleteForMe = () => {
    setMenuOpen(false);
    setTouchOpen(false);
    setDeleteIntent("me");
  };

  const handleReply = () => {
    onReply(message);
    setTouchOpen(false);
  };

  const handleDeleteForEveryone = () => {
    setMenuOpen(false);
    setTouchOpen(false);
    setDeleteIntent("everyone");
  };

  const confirmDelete = () => {
    if (deleteIntent === "me") onDeleteForMe(message);
    if (deleteIntent === "everyone") onDeleteForEveryone(message);
    setDeleteIntent(null);
  };

  const deleteTitle = deleteIntent === "everyone" ? "Apagar mensagem para todos?" : "Apagar mensagem para mim?";
  const deleteDescription =
    deleteIntent === "everyone"
      ? "Esta ação tentará remover a mensagem para todos no WhatsApp. Depois de confirmada, não será possível desfazer pelo Zapo Manager."
      : "Esta ação remove a mensagem apenas desta conversa no Zapo Manager. Ela não será apagada do WhatsApp do contato.";

  const handleCopy = async () => {
    const text = getMessageText(message.message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } finally {
      setMenuOpen(false);
      setTouchOpen(false);
    }
  };

  return (
    <>
      <div className={`flex w-full ${fromMe ? "justify-end" : "justify-start"}`} onContextMenu={handleContextMenu} onBlur={() => setTouchOpen(false)}>
        <div className="group/actions relative min-w-0 max-w-[75%]">
          {children}
          <div
            data-open={toolbarOpen ? "true" : undefined}
            className={`absolute -top-3 z-30 flex h-7 items-center gap-0.5 rounded-full border border-border bg-popover/95 px-1 shadow-md opacity-0 backdrop-blur-sm transition-opacity group-hover/actions:opacity-100 group-focus-within/actions:opacity-100 data-[open=true]:opacity-100 ${
              fromMe ? "right-3" : "left-3"
            }`}>
            <DropdownMenu open={reactionOpen} onOpenChange={setReactionOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Reagir"
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={fromMe ? "end" : "start"} sideOffset={6} className="flex w-auto flex-row gap-1 p-1.5">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-muted"
                    onClick={() => handleReact(emoji)}
                    aria-label={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={handleCopy}
              className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
              aria-label="Copiar"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleReply}
              className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
              aria-label="Responder"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Opções de exclusão"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={fromMe ? "end" : "start"} sideOffset={6} className="border-border bg-popover">
                <DropdownMenuItem onClick={handleDeleteForMe} className="cursor-pointer">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Apagar para mim
                </DropdownMenuItem>
                {canDeleteForEveryone && (
                  <DropdownMenuItem onClick={handleDeleteForEveryone} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Apagar para todos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <Dialog open={!!deleteIntent} onOpenChange={(open) => !open && setDeleteIntent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {deleteTitle}
            </DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDeleteIntent(null)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={confirmDelete}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper function to extract text content from message
const getMessageText = (messageObj: any): string => {
  if (!messageObj) return "";

  // Try to parse if it's a string
  if (typeof messageObj === "string") {
    try {
      const parsed = JSON.parse(messageObj);
      return parsed.conversation || parsed.text || messageObj;
    } catch {
      return messageObj;
    }
  }

  // If it's already an object, extract conversation or text
  if (typeof messageObj === "object") {
    return messageObj.conversation || messageObj.text || messageObj.extendedTextMessage?.text || "";
  }

  return String(messageObj);
};

const getContextInfo = (messageObj: any) => {
  if (!messageObj || typeof messageObj !== "object") return null;
  return (
    messageObj.extendedTextMessage?.contextInfo ||
    messageObj.imageMessage?.contextInfo ||
    messageObj.videoMessage?.contextInfo ||
    messageObj.audioMessage?.contextInfo ||
    messageObj.documentMessage?.contextInfo ||
    null
  );
};

const buildReplyPreview = (messageObj: any): string => {
  const text = getMessageText(messageObj);
  if (text) return text;
  if (messageObj?.imageMessage) return messageObj.imageMessage.caption || "Imagem";
  if (messageObj?.videoMessage) return messageObj.videoMessage.caption || "Vídeo";
  if (messageObj?.audioMessage) return "Áudio";
  if (messageObj?.documentMessage) return messageObj.documentMessage.fileName || "Documento";
  if (messageObj?.stickerMessage) return "Sticker";
  if (messageObj?.locationMessage) return messageObj.locationMessage.name || "Localização";
  if (messageObj?.contactMessage) return messageObj.contactMessage.displayName || "Contato";
  return "Mensagem";
};

const ReplyQuote = ({ authorLabel, preview, onClear }: { authorLabel: string; preview: string; onClear?: () => void }) => (
  <div className="relative flex min-w-0 items-center overflow-hidden rounded-md border bg-muted/40">
    <div className="absolute left-0 h-full w-1 rounded-l-md bg-primary" />
    <div className="min-w-0 flex-1 px-3 py-2 pl-4">
      <div className="truncate text-xs font-semibold text-primary">{authorLabel}</div>
      <div className="truncate text-xs text-muted-foreground">{preview}</div>
    </div>
    {onClear && (
      <button type="button" className="mr-1 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClear} aria-label="Remover resposta">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

const MessageReactions = ({ reactions, fromMe }: { reactions?: Reaction[]; fromMe: boolean }) => {
  if (!reactions?.length) return null;

  const grouped = reactions.reduce(
    (acc, reaction) => {
      acc[reaction.emoji] = acc[reaction.emoji] ?? { emoji: reaction.emoji, count: 0 };
      acc[reaction.emoji].count += 1;
      return acc;
    },
    {} as Record<string, { emoji: string; count: number }>,
  );

  const visible = Object.values(grouped).slice(0, 3);

  return (
    <div className={`pointer-events-none absolute -bottom-3.5 z-20 flex ${fromMe ? "right-0" : "left-0"}`}>
      <div className="flex min-h-5 items-center rounded-full border border-border bg-background px-1.5 py-0.5 text-xs shadow-sm">
        {visible.map((reaction) => (
          <span key={reaction.emoji} className="leading-none">
            {reaction.emoji}
          </span>
        ))}
        {reactions.length > 1 && <span className="ml-1 text-[11px] leading-none text-muted-foreground">{reactions.length}</span>}
      </div>
    </div>
  );
};

const DOODLE_BG_CLASSES = "bg-background bg-[url('/inbox-doodle.svg')] bg-repeat";

// Component to render different message types based on messageType
const MessageContent = ({ message }: { message: Message }) => {
  const messageType = message.messageType as string;
  const { t } = useTranslation();
  const contextInfo = getContextInfo(message.message);
  const quotedMessage = contextInfo?.quotedMessage;
  const quotedPreview = quotedMessage ? buildReplyPreview(quotedMessage) : "";
  const content = (() => {

  switch (messageType) {
    case "conversation":
      if (message.message.contactMessage) {
        const contactMsg = message.message.contactMessage;
        return (
          <div className="p-3 bg-muted rounded-lg max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xl">👤</div>
              <span className="font-medium">Contact</span>
            </div>
            {contactMsg.displayName && <p className="text-sm font-medium">{contactMsg.displayName}</p>}
            {contactMsg.vcard && <p className="text-xs text-muted-foreground">Contact card</p>}
          </div>
        );
      }

      if (message.message.locationMessage) {
        const locationMsg = message.message.locationMessage;
        return (
          <div className="p-3 bg-muted rounded-lg max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xl">📍</div>
              <span className="font-medium">Location</span>
            </div>
            {locationMsg.name && <p className="text-sm font-medium">{locationMsg.name}</p>}
            {locationMsg.address && <p className="text-xs text-muted-foreground">{locationMsg.address}</p>}
            {locationMsg.degreesLatitude && locationMsg.degreesLongitude && (
              <a
                href={`https://maps.google.com/?q=${locationMsg.degreesLatitude},${locationMsg.degreesLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm mt-1 inline-block">
                View on Maps
              </a>
            )}
          </div>
        );
      }

      return <span>{getMessageText(message.message)}</span>;

    case "extendedTextMessage":
      return <span>{message.message.conversation ?? message.message.extendedTextMessage?.text}</span>;

    case "imageMessage":
      // Use base64 data or mediaUrl for images
      const imageBase64 = message.message.base64 ? (message.message.base64.startsWith("data:") ? message.message.base64 : `data:image/jpeg;base64,${message.message.base64}`) : null;

      const imageSrc = imageBase64 || message.message.mediaUrl;

      return (
        <div className="flex flex-col gap-2">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Image"
              className="rounded-lg max-w-full h-auto"
              style={{
                maxWidth: "400px",
                maxHeight: "400px",
                objectFit: "contain",
              }}
              loading="lazy"
            />
          ) : (
            <div className="rounded bg-muted p-4 max-w-xs">
              <p className="text-center text-muted-foreground">Image couldn't be loaded</p>
              <p className="text-center text-xs text-muted-foreground mt-1">Missing base64 data and mediaUrl</p>
            </div>
          )}
          {message.message.imageMessage?.caption && <p className="text-sm">{message.message.imageMessage.caption}</p>}
        </div>
      );

    case "videoMessage":
      // Use base64 data or mediaUrl for videos
      const videoBase64 = message.message.base64 ? (message.message.base64.startsWith("data:") ? message.message.base64 : `data:video/mp4;base64,${message.message.base64}`) : null;

      const videoSrc = videoBase64 || message.message.mediaUrl;

      return (
        <div className="flex flex-col gap-2">
          {videoSrc ? (
            <video
              src={videoSrc}
              controls
              className="rounded-lg max-w-full h-auto"
              style={{
                maxWidth: "400px",
                maxHeight: "400px",
              }}
            />
          ) : (
            <div className="rounded bg-muted p-4 max-w-xs">
              <p className="text-center text-muted-foreground">Video couldn't be loaded</p>
              <p className="text-center text-xs text-muted-foreground mt-1">Missing base64 data and mediaUrl</p>
            </div>
          )}
          {message.message.videoMessage?.caption && <p className="text-sm">{message.message.videoMessage.caption}</p>}
        </div>
      );

    case "audioMessage":
      // Use base64 data or mediaUrl for audio
      const audioBase64 = message.message.base64 ? (message.message.base64.startsWith("data:") ? message.message.base64 : `data:audio/mpeg;base64,${message.message.base64}`) : null;

      const audioSrc = audioBase64 || message.message.mediaUrl;

      return audioSrc ? (
        <audio controls className="w-full max-w-xs">
          <source src={audioSrc} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <div className="rounded bg-muted p-4 max-w-xs">
          <p className="text-center text-muted-foreground">Audio couldn't be loaded</p>
          <p className="text-center text-xs text-muted-foreground mt-1">Missing base64 data and mediaUrl</p>
        </div>
      );

    case "documentMessage":
      return (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg max-w-xs">
          <div className="text-2xl">📄</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{message.message.documentMessage?.fileName || "Document"}</p>
            {message.message.documentMessage?.fileLength && <p className="text-xs text-muted-foreground">{(message.message.documentMessage.fileLength / 1024 / 1024).toFixed(2)} MB</p>}
          </div>
        </div>
      );

    case "stickerMessage":
      // stickerMessage.url aponta para o arquivo .enc criptografado no CDN do
      // WhatsApp — nunca renderizável direto num <img>. Só mediaUrl/base64
      // (mídia já decriptada) servem de fonte válida aqui.
      const stickerSrc = message.message.mediaUrl || (message.message.base64 ? (message.message.base64.startsWith("data:") ? message.message.base64 : `data:image/webp;base64,${message.message.base64}`) : null);
      return stickerSrc ? (
        <img src={stickerSrc} alt="Sticker" className="max-w-32 max-h-32 object-contain" />
      ) : (
        <div className="flex items-center gap-1.5 p-2 bg-muted rounded text-xs text-muted-foreground">
          <span>💟</span>
          <span>Sticker</span>
        </div>
      );

    case "reactionMessage":
      const reactionText = message.message.reactionMessage?.text || "";
      return (
        <span className="italic text-muted-foreground/90 flex items-center gap-1">
          <span>{t("chat.message.reacted", { defaultValue: "Reagiu com:" })}</span>
          <span className="not-italic text-base font-normal">{reactionText}</span>
        </span>
      );

    default:
      // Fallback for unknown message types
      return (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-w-xs">
          <details>
            <summary>Unknown message type: {messageType}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(message.message, null, 2)}</pre>
          </details>
        </div>
      );
  }
  })();

  if (!quotedMessage) return content;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ReplyQuote
        authorLabel={message.key.fromMe ? "Contato" : "Você"}
        preview={quotedPreview}
      />
      {content}
    </div>
  );
};

type ChatComposerProps = {
  instance: NonNullable<ReturnType<typeof useInstance>["instance"]>;
  remoteJid?: string;
  chatName?: string;
  selectedMedia: File | null;
  setSelectedMedia: Dispatch<SetStateAction<File | null>>;
  replyTo: Message | null;
  setReplyTo: (message: Message | null) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  handleTextareaChange: () => void;
  textareaHeight: string;
};

const ChatComposer = memo(function ChatComposer({
  instance,
  remoteJid,
  chatName,
  selectedMedia,
  setSelectedMedia,
  replyTo,
  setReplyTo,
  textareaRef,
  handleTextareaChange,
  textareaHeight,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { sendText: sendTextMutation } = useSendMessage();
  const { sendMedia: sendMediaMutation } = useSendMedia();

  const resetComposer = () => {
    setMessageText("");
    setReplyTo(null);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      handleTextareaChange();
    }
  };

  const sendTextMessage = async () => {
    const text = messageText.trim();
    if (!text || !remoteJid || !instance?.name || !instance?.token || isSending) return;

    try {
      setIsSending(true);
      await sendTextMutation({
        instanceName: instance.name,
        token: instance.token,
        data: {
          number: remoteJid,
          text,
          quoted: replyTo ?? undefined,
        },
      });
      resetComposer();
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const sendMediaMessage = async () => {
    if (!selectedMedia || !remoteJid || !instance?.name || !instance?.token || isSending) return;

    try {
      setIsSending(true);
      const mediaKind = getChatMediaKind(selectedMedia);
      if (!mediaKind) {
        toast.error(t("chat.media.errors.unsupportedType"));
        return;
      }

      const caption = mediaKind === "audio" ? undefined : messageText.trim().slice(0, MEDIA_CAPTION_MAX) || undefined;
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedMedia);
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(",")[1]);
        };
        reader.onerror = reject;
      });

      await sendMediaMutation({
        instanceName: instance.name,
        token: instance.token,
        data: {
          number: remoteJid,
          mediaMessage: {
            mediatype: mediaKind,
            mimetype: selectedMedia.type,
            caption,
            media: base64Data,
            fileName: mediaKind === "document" ? selectedMedia.name : undefined,
          },
          quoted: replyTo ?? undefined,
        },
      });

      setSelectedMedia(null);
      resetComposer();
    } catch (error) {
      console.error("Error sending media:", error);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    if (selectedMedia) {
      await sendMediaMessage();
    } else {
      await sendTextMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    handleTextareaChange();
  };

  return (
    <div className="flex-shrink-0 border-t bg-background p-3">
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {selectedMedia && (
          <div className="border-b border-border bg-muted/30 px-3 py-2">
            <SelectedMedia selectedMedia={selectedMedia} setSelectedMedia={setSelectedMedia} />
          </div>
        )}
        {replyTo && (
          <div className="border-b border-border bg-muted/30 px-3 py-2">
            <ReplyQuote
              authorLabel={replyTo.key.fromMe ? "Você" : chatName || "Contato"}
              preview={buildReplyPreview(replyTo.message)}
              onClear={() => setReplyTo(null)}
            />
          </div>
        )}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex flex-shrink-0 items-center">
            {instance && <MediaOptions instance={instance} setSelectedMedia={setSelectedMedia} />}
          </div>
          <Textarea
            placeholder={t("chat.input.placeholder", { defaultValue: "Digite uma mensagem..." })}
            name="message"
            id="message"
            rows={1}
            ref={textareaRef}
            value={messageText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            style={{ height: textareaHeight }}
            className="min-h-9 flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void sendMessage()}
            disabled={(!messageText.trim() && !selectedMedia) || isSending}
            className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">{t("chat.input.send")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
});

function Messages({ textareaRef, handleTextareaChange, textareaHeight, lastMessageRef, scrollToBottom }: MessagesProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { instance } = useInstance();
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const { sendReaction } = useSendReaction();
  const { revokeMessage } = useRevokeMessage();
  const { deleteMessageForMe } = useDeleteMessageForMe();

  const { remoteJid } = useParams<{ remoteJid: string }>();

  const handleReactMessage = (message: Message, emoji: string) => {
    if (!instance?.name || !instance?.token) return;
    sendReaction(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key, reaction: emoji },
      },
      {
        onSuccess: (response: any) => {
          const responseKey = response?.key ?? response?.message?.key;
          const reactionId = responseKey?.id ?? `local-reaction-${message.key.id}-${Date.now()}`;
          const reactionMessage: Message = {
            id: reactionId,
            key: responseKey ?? {
              remoteJid: message.key.remoteJid,
              fromMe: true,
              id: reactionId,
            },
            pushName: "",
            messageType: "reactionMessage",
            message: {
              reactionMessage: {
                key: message.key,
                text: emoji,
              },
            },
            messageTimestamp: String(Math.floor(Date.now() / 1000)),
            instanceId: instance.name,
            source: "local",
          };

          setRealtimeMessages((prevMessages) => {
            const withoutSameReaction = prevMessages.filter((msg) => {
              if (msg.messageType !== "reactionMessage") return true;
              const targetId = msg.message?.reactionMessage?.key?.id;
              return targetId !== message.key.id || msg.key.fromMe !== true;
            });
            return [...withoutSameReaction, reactionMessage];
          });
        },
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
  };

  const handleReplyMessage = (message: Message) => {
    setReplyTo(message);
    textareaRef.current?.focus();
  };

  const handleDeleteMessageForMe = (message: Message) => {
    if (!instance?.name || !instance?.token) return;
    deleteMessageForMe(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key },
      },
      {
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
  };

  const handleDeleteMessageForEveryone = (message: Message) => {
    if (!instance?.name || !instance?.token || !message.key.fromMe) return;
    revokeMessage(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key },
      },
      {
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
  };

  const { data: chat } = useFindChat({
    remoteJid,
    instanceName: instance?.name,
  });

  const { data: messages, isSuccess } = useFindMessages({
    remoteJid,
    instanceName: instance?.name,
    refetchInterval: 3000,
  });

  // Combine React Query messages with real-time updates
  const allMessages = useMemo(() => {
    if (!messages) return realtimeMessages;

    // Merge messages from React Query with real-time updates
    const messageMap = new Map();

    // First add all messages from React Query
    messages.forEach((message) => messageMap.set(message.key.id, message));

    // Then add/update with real-time messages
    realtimeMessages.forEach((message) => {
      messageMap.set(message.key.id, message);
    });

    return groupReactionsAndRevokes(Array.from(messageMap.values()));
  }, [messages, realtimeMessages]);

  // Add websocket functionality for real-time message updates
  useEffect(() => {
    if (!instance?.name || !remoteJid) return;

    const serverUrl = getToken(TOKEN_ID.API_URL);
    if (!serverUrl) {
      console.error("API URL not found in localStorage");
      return;
    }

    const socket = connectSocket(serverUrl, {
      apikey: instance.token,
      instanceName: instance.name,
    });

    // Function to update messages from websocket events
    const updateMessagesFromWebsocket = (_eventType: string, data: any) => {
      if (!instance) return;

      if (data.instance !== instance.name) {
        return;
      }

      if (data?.data?.key?.remoteJid !== remoteJid) {
        return;
      }

      const message = data.data;

      setRealtimeMessages((prevMessages) => {
        // Check if message already exists
        const existingIndex = prevMessages.findIndex((msg) => msg.key.id === message.key.id);

        if (existingIndex !== -1) {
          // Update existing message
          const updatedMessages = [...prevMessages];
          updatedMessages[existingIndex] = message;
          return updatedMessages;
        } else {
          // Add new message
          return [...prevMessages, message];
        }
      });
    };

    // Function to update message status (simplified - just log for now)
    const updateMessageStatus = (data: any) => {
      if (!instance) return;
      if (data.instance !== instance.name) return;

      console.log("Received message status update:", data);
      // TODO: Implement proper message status updates when Message type supports it
    };

    const onUpsert = (data: any) => updateMessagesFromWebsocket("messages.upsert", data);
    const onSend = (data: any) => updateMessagesFromWebsocket("send.message", data);
    const onUpdate = (data: any) => updateMessageStatus(data);

    socket.on("messages.upsert", onUpsert);
    socket.on("send.message", onSend);
    socket.on("messages.update", onUpdate);

    socket.connect();

    return () => {
      socket.offHandler("messages.upsert", onUpsert);
      socket.offHandler("send.message", onSend);
      socket.offHandler("messages.update", onUpdate);
    };
  }, [instance?.name, remoteJid]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    if (!allMessages) return [];

    // Sort messages by timestamp first
    const sortedMessages = [...allMessages].sort((a, b) => {
      const aTime = getMessageTimestamp(a).getTime();
      const bTime = getMessageTimestamp(b).getTime();
      return aTime - bTime;
    });

    const grouped: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    let currentGroup: Message[] = [];

    sortedMessages.forEach((message) => {
      const messageDate = getMessageTimestamp(message);
      const dateString = messageDate.toDateString();

      if (dateString !== currentDate) {
        if (currentGroup.length > 0) {
          grouped.push({
            date: formatDateSeparator(new Date(currentDate), t, locale),
            messages: currentGroup,
          });
        }
        currentDate = dateString;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      grouped.push({
        date: formatDateSeparator(new Date(currentDate), t, locale),
        messages: currentGroup,
      });
    }

    return grouped;
  }, [allMessages, t, locale]);

  useEffect(() => {
    if (isSuccess && allMessages) {
      scrollToBottom();
    }
  }, [isSuccess, allMessages, scrollToBottom]);

  // Clear selected media and real-time messages when switching chats
  useEffect(() => {
    setSelectedMedia(null);
    setReplyTo(null);
    setRealtimeMessages([]); // Clear real-time messages when switching chats
    if (textareaRef.current) {
      textareaRef.current.value = "";
      handleTextareaChange();
    }
  }, [remoteJid]);

  const renderBubbleRight = (message: Message) => (
    <div key={message.id} className={message.reactions?.length ? "mb-7" : "mb-4"}>
      <MessageActions
        message={message}
        canDeleteForEveryone={message.key.fromMe && instance?.integration !== "WHATSAPP-BUSINESS"}
        onReact={handleReactMessage}
        onReply={handleReplyMessage}
        onDeleteForMe={handleDeleteMessageForMe}
        onDeleteForEveryone={handleDeleteMessageForEveryone}
      >
        <div className="relative rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          <MessageContent message={message} />
          <div className="mt-1 flex justify-end">
            <span className="text-[11px] text-primary-foreground/70">
              {formatMessageTime(getMessageTimestamp(message), locale)}
            </span>
          </div>
          <MessageReactions reactions={message.reactions} fromMe={true} />
        </div>
      </MessageActions>
    </div>
  );

  const renderBubbleLeft = (message: Message) => {
    const isGroup = !!remoteJid?.endsWith("@g.us");
    const participant = message.key.participant;
    const senderKey = participant || message.pushName || "";
    const senderName = message.pushName || (participant ? participant.split("@")[0] : "");

    return (
      <div key={message.id} className={message.reactions?.length ? "mb-7" : "mb-4"}>
        <div className="max-w-[70%]">
          {isGroup && senderName && (
            <div className="mb-1 text-xs font-semibold" style={{ color: getSenderColor(senderKey) }}>
              {senderName}
            </div>
          )}
        </div>
        <MessageActions
          message={message}
          canDeleteForEveryone={false}
          onReact={handleReactMessage}
          onReply={handleReplyMessage}
          onDeleteForMe={handleDeleteMessageForMe}
          onDeleteForEveryone={handleDeleteMessageForEveryone}
        >
          <div className="relative rounded-lg border bg-muted px-3 py-2 text-sm text-foreground">
            <MessageContent message={message} />
            <div className="mt-1 flex justify-start">
              <span className="text-[11px] text-muted-foreground">
                {formatMessageTime(getMessageTimestamp(message), locale)}
              </span>
            </div>
            <MessageReactions reactions={message.reactions} fromMe={false} />
          </div>
        </MessageActions>
      </div>
    );
  };

  const headerName = chat?.pushName || chat?.remoteJid?.split("@")[0];
  const headerSub = chat?.remoteJid?.split("@")[0];

  return (
    <div className="flex h-full flex-col bg-muted/10">
      <div className="flex-shrink-0 border-b bg-background/95 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={chat?.profilePicUrl} alt={headerName} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{headerName}</h3>
            <p className="truncate text-xs text-muted-foreground">{headerSub}</p>
          </div>
          {instance?.name && remoteJid && (
            <ConversationStatusBadge instanceName={instance.name} remoteJid={remoteJid} />
          )}
        </div>
      </div>
      <div className={`flex w-full flex-1 flex-col overflow-y-auto px-4 py-4 ${DOODLE_BG_CLASSES}`}>
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            <DateSeparator date={group.date} />
            {group.messages.map((message) =>
              message.key.fromMe ? renderBubbleRight(message) : renderBubbleLeft(message),
            )}
          </div>
        ))}
        <div ref={lastMessageRef as never} />
      </div>
      {instance && (
        <ChatComposer
          key={remoteJid}
          instance={instance}
          remoteJid={remoteJid}
          chatName={chat?.pushName}
          selectedMedia={selectedMedia}
          setSelectedMedia={setSelectedMedia}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          textareaRef={textareaRef}
          handleTextareaChange={handleTextareaChange}
          textareaHeight={textareaHeight}
        />
      )}
    </div>
  );
}

export { Messages };
