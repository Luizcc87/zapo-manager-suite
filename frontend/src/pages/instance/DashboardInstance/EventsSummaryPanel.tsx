import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Button } from "@evoapi/design-system/button";
import { AlertTriangle, BarChart3, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { useInstanceEventsSummary, useSendInstanceEventsSummary } from "@/lib/queries/instance/events";

type Props = {
  instanceName: string;
  numberFormatter: Intl.NumberFormat;
};

const severityItems = [
  { key: "critical", label: "Críticos", className: "bg-red-500" },
  { key: "warning", label: "Atenção", className: "bg-amber-500" },
  { key: "info", label: "Info", className: "bg-sky-500" },
] as const;

export function EventsSummaryPanel({ instanceName, numberFormatter }: Props) {
  const { t } = useTranslation();
  const { data, isError } = useInstanceEventsSummary(instanceName);
  const sendSummary = useSendInstanceEventsSummary(instanceName);

  if (isError || !data) return null;

  const hasEvents = data.total > 0;

  const handleSend = async () => {
    if (!hasEvents) return;

    try {
      await sendSummary.mutateAsync(7);
      toast.success(t("instance.dashboard.eventsSummary.sent", { defaultValue: "Resumo enviado por Telegram." }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    }
  };

  return (
    <Card className="border-sidebar-border bg-sidebar">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            {t("instance.dashboard.eventsSummary.title", { defaultValue: "Resumo de eventos" })}
          </CardTitle>
          <Button size="sm" variant="outline" className="gap-2" disabled={!hasEvents || sendSummary.isPending} onClick={handleSend}>
            <Send className="h-4 w-4" />
            {t("instance.dashboard.eventsSummary.send", { defaultValue: "Enviar resumo" })}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <p className="text-xs text-muted-foreground">{t("instance.dashboard.eventsSummary.total", { defaultValue: "Últimos 7 dias" })}</p>
            <p className="mt-1 text-xl font-semibold">{numberFormatter.format(data.total)}</p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <p className="text-xs text-muted-foreground">{t("instance.dashboard.eventsSummary.unread", { defaultValue: "Não lidos" })}</p>
            <p className="mt-1 text-xl font-semibold">{numberFormatter.format(data.unreadCount)}</p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <p className="text-xs text-muted-foreground">{t("instance.dashboard.eventsSummary.critical", { defaultValue: "Críticos" })}</p>
            <p className="mt-1 text-xl font-semibold">{numberFormatter.format(data.severity.critical)}</p>
          </div>
        </div>

        {!hasEvents && (
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3 text-sm text-muted-foreground">
            {t("instance.dashboard.eventsSummary.empty", {
              defaultValue: "Nenhum evento registrado nos últimos 7 dias. O envio do resumo fica disponível quando houver eventos para relatar.",
            })}
          </div>
        )}

        <div className="space-y-2">
          {severityItems.map((item) => {
            const value = data.severity[item.key];
            const width = data.total > 0 ? `${Math.max((value / data.total) * 100, value > 0 ? 6 : 0)}%` : "0%";
            return (
              <div key={item.key} className="grid grid-cols-[72px_1fr_40px] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <div className="h-2 rounded-full bg-sidebar-accent">
                  <div className={`h-2 rounded-full ${item.className}`} style={{ width }} />
                </div>
                <span className="text-right font-mono">{numberFormatter.format(value)}</span>
              </div>
            );
          })}
        </div>

        {data.lastCritical && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{data.lastCritical.title}</p>
              <p className="break-words text-xs text-muted-foreground">{data.lastCritical.summary}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
