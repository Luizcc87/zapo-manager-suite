import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Activity, CircleUser, Clock, Database, HardDrive, MessageCircle, Radio, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Instance } from "@/types/evolution.types";

type Props = {
  instance: Instance;
  numberFormatter: Intl.NumberFormat;
};

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveConnectionLabel(instance: Instance) {
  const details = instance.operational?.connectionDetails;
  if (instance.connectionStatus === "open") return "Conectada";
  if (details?.hasQrCode) return "Aguardando QR";
  if (details?.hasActiveClient && !details?.registered) return "Cliente ativo sem registro";
  if (!details?.hasActiveClient) return "Sem cliente ativo";
  return "Desconectada";
}

function resolveProxyStatus(instance: Instance, t: ReturnType<typeof useTranslation>["t"]) {
  if (!instance.proxyEnabled) {
    return {
      value: t("instance.dashboard.proxy.disabled", { defaultValue: "Desativado" }),
      detail: t("instance.dashboard.proxy.disabledDetail", { defaultValue: "Conexão direta" }),
    };
  }

  if (instance.proxyConnected === true) {
    return {
      value: t("instance.dashboard.proxy.connected", { defaultValue: "Conectado" }),
      detail: t("instance.dashboard.proxy.connectedDetail", { defaultValue: "Proxy ativo" }),
    };
  }

  if (instance.proxyConnected === false || instance.operational?.proxyHealth?.severity === "critical") {
    return {
      value: t("instance.dashboard.proxy.failed", { defaultValue: "Falhou" }),
      detail: instance.operational?.proxyHealth?.reason || instance.proxyError || t("instance.dashboard.proxy.failedDetail", { defaultValue: "Verificar configurações" }),
    };
  }

  return {
    value: t("instance.dashboard.proxy.checking", { defaultValue: "Verificando" }),
    detail: t("instance.dashboard.proxy.checkingDetail", { defaultValue: "Status ainda não confirmado" }),
  };
}

export function OperationalStatsGrid({ instance, numberFormatter }: Props) {
  const { t, i18n } = useTranslation();
  const operational = instance.operational;
  const contactCount = operational?.contactCount ?? instance._count?.Contact ?? 0;
  const chatCount = operational?.chatStats?.total ?? instance._count?.Chat ?? 0;
  const messageCount = instance._count?.Message ?? 0;
  const lastActivityAt = operational?.lastActivityAt ?? operational?.chatStats?.lastUpdatedAt ?? null;
  const lastActivityLabel = formatDateTime(lastActivityAt, i18n.language) ?? t("instance.dashboard.operational.noActivity", { defaultValue: "Sem atividade registrada" });
  const historyMode = operational?.historyPersistence?.mode ?? "memory";
  const historyLabel = historyMode === "database"
    ? t("instance.dashboard.operational.historyDatabase", { defaultValue: "Banco de dados" })
    : t("instance.dashboard.operational.historyMemory", { defaultValue: "Memória" });
  const connectionLabel = useMemo(() => resolveConnectionLabel(instance), [instance]);
  const proxyStatus = useMemo(() => resolveProxyStatus(instance, t), [instance, t]);

  const items = [
    {
      title: t("instance.dashboard.contacts", { defaultValue: "Contatos" }),
      value: numberFormatter.format(contactCount),
      detail: t("instance.dashboard.operational.contactsDetail", { defaultValue: "Sincronizados na store" }),
      icon: CircleUser,
    },
    {
      title: t("instance.dashboard.chats", { defaultValue: "Chats" }),
      value: numberFormatter.format(chatCount),
      detail: operational?.chatStats?.lastRemoteJid
        ? t("instance.dashboard.operational.lastChat", { defaultValue: "Último chat atualizado" })
        : t("instance.dashboard.operational.noChats", { defaultValue: "Nenhum chat registrado" }),
      icon: UsersRound,
    },
    {
      title: t("instance.dashboard.messages", { defaultValue: "Mensagens" }),
      value: numberFormatter.format(messageCount),
      detail: historyMode === "database"
        ? t("instance.dashboard.operational.messagesPersisted", { defaultValue: "Persistência ativa" })
        : t("instance.dashboard.operational.messagesMemory", { defaultValue: "Histórico em memória" }),
      icon: MessageCircle,
    },
    {
      title: t("instance.dashboard.operational.lastActivity", { defaultValue: "Última atividade" }),
      value: lastActivityLabel,
      detail: lastActivityAt
        ? t("instance.dashboard.operational.activityFromChats", { defaultValue: "Baseada nos chats" })
        : t("instance.dashboard.operational.emptyState", { defaultValue: "Aguardando eventos" }),
      icon: Clock,
    },
    {
      title: t("instance.dashboard.operational.messageStorage", { defaultValue: "Persistência de mensagens" }),
      value: historyLabel,
      detail: historyMode === "database"
        ? t("instance.dashboard.operational.messagesSurviveRestart", { defaultValue: "Mensagens preservadas após restart" })
        : t("instance.dashboard.operational.messagesLostOnRestart", { defaultValue: "Mensagens podem sumir no restart" }),
      icon: historyMode === "database" ? Database : HardDrive,
    },
    {
      title: t("instance.dashboard.operational.connection", { defaultValue: "Conexão" }),
      value: connectionLabel,
      detail: operational?.connectionDetails?.lastKnownStatus || instance.connectionStatus,
      icon: instance.connectionStatus === "open" ? Radio : Activity,
    },
    {
      title: t("instance.dashboard.proxy.title", { defaultValue: "Proxy" }),
      value: proxyStatus.value,
      detail: proxyStatus.detail,
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="border-sidebar-border bg-sidebar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon size="18" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="truncate text-2xl font-bold" title={String(item.value)}>
                {item.value}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={String(item.detail)}>
                {item.detail}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
