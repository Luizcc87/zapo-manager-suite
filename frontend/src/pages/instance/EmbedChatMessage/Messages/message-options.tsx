import { ChevronDown, ReplyIcon, DeleteIcon, SmilePlusIcon } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";

import { useEmbedColors } from "@/contexts/EmbedColorsContext";
import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { ReplyMessageContext } from "@/contexts/ReplyingMessage/ReplyingMessageContext";

import { useSendReaction, useRevokeMessage } from "@/lib/queries/chat/sendMessage";

import { Message } from "@/types/evolution.types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MessageOptions = ({ message, fromMe }: { message: Message; fromMe: boolean }) => {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { fromMeBubbleColor, fromOtherBubbleColor } = useEmbedColors();
  const { sendReaction } = useSendReaction();
  const { revokeMessage } = useRevokeMessage();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleReact = (emoji: string) => {
    if (!instance?.name || !instance?.token) return;
    sendReaction(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { key: message.key, reaction: emoji },
      },
      {
        onError: () => toast.error(t("chat.toast.error")),
      },
    );
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async () => {
    if (!instance?.name || !instance?.token) return;
    if (!message.key.fromMe) return;
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

  return (
    <div className="absolute right-0 top-0 z-50 flex gap-1 opacity-100 transition-all duration-300 sm:invisible sm:opacity-0 sm:group-hover:visible sm:group-hover:opacity-100 sm:group-focus-within:visible sm:group-focus-within:opacity-100">
      <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full"
            style={{ backgroundColor: fromMe ? fromMeBubbleColor : fromOtherBubbleColor }}>
            <SmilePlusIcon className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">{t("chat.message.react")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex gap-1 p-2">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" className="rounded p-1 text-lg hover:bg-muted" onClick={() => handleReact(emoji)}>
              {emoji}
            </button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            id="message-options"
            className="rounded-full"
            style={{ backgroundColor: fromMe ? fromMeBubbleColor : fromOtherBubbleColor }}>
            <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">{t("chat.message.options")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setReplyingMessage(message)} className="cursor-pointer">
            <ReplyIcon className="mr-2 h-4 w-4" />
            {t("chat.message.reply")}
          </DropdownMenuItem>
          {instance?.integration !== "WHATSAPP-BUSINESS" && fromMe && (
            <DropdownMenuItem onClick={handleDeleteMessage} className="cursor-pointer">
              <DeleteIcon className="mr-2 h-4 w-4" />
              {t("chat.message.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export { MessageOptions };
