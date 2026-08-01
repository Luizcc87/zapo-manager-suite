import { Badge } from "@evoapi/design-system/badge";
import { Button } from "@evoapi/design-system/button";
import { Label } from "@evoapi/design-system/label";
import { BellRing, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Input } from "@/components/ui/input";
import {
  useDeleteNotificationChannel,
  useNotificationChannels,
  useSaveTelegramChannel,
  useTestTelegramChannel,
} from "@/lib/queries/instance/notificationChannels";

type Props = {
  instanceName: string;
};

const DEFAULT_EVENTS = ["proxy.test_failed", "mobile_account_takeover_notice", "mobile_registration_code", "operational.summary"];

export function TelegramChannelPanel({ instanceName }: Props) {
  const { t } = useTranslation();
  const { data, isError } = useNotificationChannels(instanceName);
  const telegramChannel = useMemo(
    () => data?.channels.find((channel) => channel.type === "telegram"),
    [data],
  );
  const saveChannel = useSaveTelegramChannel(instanceName, telegramChannel?.id);
  const deleteChannel = useDeleteNotificationChannel(instanceName);
  const testChannel = useTestTelegramChannel(instanceName);

  const [name, setName] = useState("Telegram");
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");

  useEffect(() => {
    if (!telegramChannel) return;
    setName(telegramChannel.name || "Telegram");
    setChatId(telegramChannel.config.chatId || "");
    setBotToken("");
  }, [telegramChannel]);

  if (isError) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!chatId.trim() || !botToken.trim()) {
      toast.error(t("notifications.telegram.required", { defaultValue: "Informe bot token e chat ID." }));
      return;
    }

    try {
      await saveChannel.mutateAsync({
        name: name.trim() || "Telegram",
        enabled: true,
        config: {
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        },
        events: telegramChannel?.events?.length ? telegramChannel.events : DEFAULT_EVENTS,
      });
      setBotToken("");
      toast.success(t("notifications.telegram.saved", { defaultValue: "Canal Telegram salvo." }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async () => {
    if (!telegramChannel) return;
    try {
      await deleteChannel.mutateAsync(telegramChannel.id);
      setName("Telegram");
      setChatId("");
      setBotToken("");
      toast.success(t("notifications.telegram.deleted", { defaultValue: "Canal Telegram removido." }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleTest = async () => {
    if (!telegramChannel) return;
    try {
      await testChannel.mutateAsync(telegramChannel.id);
      toast.success(t("notifications.telegram.testSent", { defaultValue: "Mensagem de teste enviada pelo Telegram." }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="mx-4 space-y-4">
      <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <BellRing className="h-4 w-4 text-sky-500" />
              {t("notifications.telegram.title", { defaultValue: "Canal Telegram" })}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("notifications.telegram.description", { defaultValue: "Envie alertas e resumos operacionais desta instância para um chat do Telegram." })}
            </p>
          </div>
          <Badge className={telegramChannel ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}>
            {telegramChannel
              ? t("notifications.telegram.configured", { defaultValue: "Configurado" })
              : t("notifications.telegram.notConfigured", { defaultValue: "Não configurado" })}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/10 p-4">
        <h4 className="text-sm font-medium">
          {t("notifications.telegram.howItWorks.title", { defaultValue: "Como funciona" })}
        </h4>
        <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.howItWorks.automaticTitle", { defaultValue: "Envios automáticos" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.howItWorks.automaticBody", { defaultValue: "Depois de salvar este canal, o Manager envia alertas críticos desta instância quando houver falha no teste do proxy, tentativa de takeover mobile ou recebimento de código de registro mobile." })}
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.howItWorks.summaryTitle", { defaultValue: "Resumo operacional" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.howItWorks.summaryBody", { defaultValue: "O resumo dos últimos 7 dias é enviado somente quando você clicar em Enviar resumo no painel Resumo de eventos da dashboard." })}
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.howItWorks.disconnectionTitle", { defaultValue: "Desconexões" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.howItWorks.disconnectionBody", { defaultValue: "Alertas de desconexão ficam desligados por padrão para evitar ruído em loops de reconnect. Eles só são enviados quando TELEGRAM_ALERT_CONNECTION_EVENTS=true." })}
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.howItWorks.fallbackTitle", { defaultValue: "Prioridade do canal" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.howItWorks.fallbackBody", { defaultValue: "Se este canal estiver configurado, ele tem prioridade para esta instância. Sem canal salvo, o backend tenta usar o Telegram global definido nas variáveis de ambiente." })}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
        <h4 className="text-sm font-medium">
          {t("notifications.telegram.credentials.title", { defaultValue: "Dados do bot" })}
        </h4>
        <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.credentials.botTokenTitle", { defaultValue: "Bot token" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.credentials.botTokenBody", { defaultValue: "Token do bot criado no @BotFather. Ele identifica quem envia as notificações pelo Telegram." })}
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <p className="font-semibold text-foreground">
              {t("notifications.telegram.credentials.chatIdTitle", { defaultValue: "Chat ID" })}
            </p>
            <p className="mt-1">
              {t("notifications.telegram.credentials.chatIdBody", { defaultValue: "Destino das notificações: seu chat privado, grupo ou canal. Em grupos/canais, adicione o bot e permita envio; IDs de grupos geralmente começam com -100." })}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 divide-y [&>*]:p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="telegram-channel-name">{t("notifications.telegram.name", { defaultValue: "Nome" })}</Label>
            <Input id="telegram-channel-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-chat-id">{t("notifications.telegram.chatId", { defaultValue: "Chat ID" })}</Label>
            <Input id="telegram-chat-id" value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder="123456789" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telegram-bot-token">{t("notifications.telegram.botToken", { defaultValue: "Bot token" })}</Label>
            <Input id="telegram-bot-token" type="password" value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder={telegramChannel ? "********" : ""} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveChannel.isPending}>
              {t("button.save", { defaultValue: "Salvar" })}
            </Button>
            {telegramChannel && (
              <Button type="button" variant="outline" disabled={testChannel.isPending} onClick={handleTest}>
                {testChannel.isPending
                  ? t("notifications.telegram.testing", { defaultValue: "Enviando..." })
                  : t("notifications.telegram.test", { defaultValue: "Enviar teste" })}
              </Button>
            )}
            {telegramChannel && (
              <Button type="button" variant="outline" size="icon" disabled={deleteChannel.isPending} onClick={handleDelete} title={t("button.delete", { defaultValue: "Excluir" })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
