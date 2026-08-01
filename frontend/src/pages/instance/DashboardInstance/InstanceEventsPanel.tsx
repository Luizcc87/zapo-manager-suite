import { Badge } from "@evoapi/design-system/badge";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Bell, Check, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type InstanceEvent, useInstanceEvents, useMarkInstanceEventRead } from "@/lib/queries/instance/events";

type Props = {
  instanceName: string;
};

function formatDateTime(value: string, language: string) {
  try {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function severityClass(severity: InstanceEvent["severity"]) {
  if (severity === "critical") return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
  if (severity === "warning") return "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20";
  return "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20";
}

function severityLabel(severity: InstanceEvent["severity"]) {
  if (severity === "critical") return "Crítico";
  if (severity === "warning") return "Atenção";
  return "Info";
}

export function InstanceEventsPanel({ instanceName }: Props) {
  const { t, i18n } = useTranslation();
  const { data, isError } = useInstanceEvents(instanceName);
  const markRead = useMarkInstanceEventRead(instanceName);
  const events = data?.events ?? [];

  if (isError || events.length === 0) return null;

  return (
    <Card className="border-sidebar-border bg-sidebar">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-amber-500" />
          {t("instance.dashboard.events.title", { defaultValue: "Eventos recentes" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex flex-col gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/10 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="break-words text-sm font-semibold">{event.title}</p>
                <Badge className={severityClass(event.severity)}>{severityLabel(event.severity)}</Badge>
                {!event.readAt && (
                  <Badge variant="secondary">{t("instance.dashboard.events.unread", { defaultValue: "Novo" })}</Badge>
                )}
              </div>
              <p className="break-words text-xs leading-normal text-muted-foreground">{event.summary}</p>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(event.createdAt, i18n.language)} · {event.type}</p>
            </div>
            {!event.readAt && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(event.id)}
              >
                <Check className="h-4 w-4" />
                {t("instance.dashboard.events.markRead", { defaultValue: "Marcar lido" })}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
