import { Bot, UserCheck, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@evoapi/design-system/dropdown-menu";

import { useFindConversationStatus } from "@/lib/queries/chat/findConversationStatus";
import { useSetConversationStatus } from "@/lib/queries/chat/manageConversationStatus";
import { ConversationStatus as StatusValue } from "@/types/evolution.types";
import { cn } from "@/lib/utils";

type ConversationStatusBadgeProps = {
  instanceName: string;
  remoteJid: string;
};

const STATUS_META: Record<StatusValue, { icon: typeof Bot; className: string }> = {
  pending: { icon: Bot, className: "bg-muted text-muted-foreground" },
  open: { icon: UserCheck, className: "bg-green-500/15 text-green-600 dark:text-green-400" },
  resolved: { icon: CheckCircle2, className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

/**
 * Badge de handoff bot/humano + menu de ações (assumir/devolver/resolver).
 * Chama a mesma rota REST usada por webhooks e agentes de IA (ConversationStatusService).
 */
export function ConversationStatusBadge({ instanceName, remoteJid }: ConversationStatusBadgeProps) {
  const { t } = useTranslation();
  const { data } = useFindConversationStatus({ instanceName, remoteJid });
  const setStatus = useSetConversationStatus();

  const status = data?.status ?? "pending";
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  const changeStatus = async (next: StatusValue, autoAssign?: boolean) => {
    try {
      await setStatus({
        instanceName,
        remoteJid,
        status: next,
        actor: { type: "human", id: "painel" },
        autoAssign,
      });
    } catch {
      toast.error(t("chat.status.pending"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium", meta.className)}
        >
          <Icon className="h-3.5 w-3.5" />
          {t(`chat.status.${status}`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "open" && (
          <DropdownMenuItem onClick={() => changeStatus("open", true)}>
            <UserCheck className="mr-2 h-4 w-4" />
            {t("chat.status.take")}
          </DropdownMenuItem>
        )}
        {status !== "pending" && (
          <DropdownMenuItem onClick={() => changeStatus("pending")}>
            <Bot className="mr-2 h-4 w-4" />
            {t("chat.status.release")}
          </DropdownMenuItem>
        )}
        {status !== "resolved" && (
          <DropdownMenuItem onClick={() => changeStatus("resolved")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("chat.status.resolve")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
