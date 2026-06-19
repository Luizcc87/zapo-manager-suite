import React from "react";

import { useEmbedColors } from "@/contexts/EmbedColorsContext";

import { cn } from "@/lib/utils";

import "./styles.css";
interface MessageBubbleProps {
  fromMe: boolean;
  children: React.ReactNode;
  isLastMessage?: boolean;
  reference?: React.RefObject<HTMLDivElement>;
  className?: string;
  id?: string;
}
export function MessageBubble({ fromMe, children, isLastMessage, reference, className, id }: MessageBubbleProps) {
  const { fromMeBubbleColor, fromOtherBubbleColor } = useEmbedColors();

  const _baseStyles = {
    className: "group relative flex max-w-[60%] flex-col break-words rounded-[16px] after:absolute after:bottom-[12px] after:border-solid after:border-[8px]",
  };

  return (
    <div
      className={cn(_baseStyles.className, fromMe ? "message-bubble-from-me" : "message-bubble-from-other", className)}
      ref={isLastMessage ? reference : null}
      id={id}
      style={{
        backgroundColor: fromMe ? fromMeBubbleColor : fromOtherBubbleColor,
        ["--from-me-bubble-color" as string]: fromMeBubbleColor,
        ["--from-other-bubble-color" as string]: fromOtherBubbleColor,
      }}>
      {children}
    </div>
  );
}

// Subcomponentes para melhor composição
MessageBubble.Content = function MessageContent({ children, className, fromMe }: { children: React.ReactNode; className?: string; fromMe: boolean }) {
  const { fromMeForegroundColor, fromOtherForegroundColor } = useEmbedColors();

  return (
    <div
      className={cn("p-4", className)}
      style={{
        color: fromMe ? fromMeForegroundColor : fromOtherForegroundColor,
      }}>
      {children}
    </div>
  );
};

MessageBubble.Footer = function MessageFooter({ children, className, fromMe }: { children: React.ReactNode; className?: string; fromMe: boolean }) {
  const { fromMeForegroundColor, fromOtherForegroundColor } = useEmbedColors();

  return (
    <div
      className={cn("flex justify-end gap-1 text-xs text-muted-foreground", className)}
      style={{
        color: fromMe ? fromMeForegroundColor : fromOtherForegroundColor,
      }}>
      {children}
    </div>
  );
};

MessageBubble.Actions = function MessageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col border-t border-black/10 dark:border-white/10", className)}>{children}</div>;
};
