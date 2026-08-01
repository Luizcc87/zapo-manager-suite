import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { ServerCog } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Instance } from "@/types/evolution.types";

import { ProxyStatusPanel } from "../Proxy";
import { RuntimeStatsPanel } from "./RuntimeStatsPanel";

type Props = {
  instance: Instance;
  instanceType: "web" | "mobile" | "primary";
  numberFormatter: Intl.NumberFormat;
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export function TechnicalDiagnosticsPanel({ instance, instanceType, numberFormatter }: Props) {
  const { t } = useTranslation();
  const connection = instance.operational?.connectionDetails;
  const proxyHealth = instance.operational?.proxyHealth;
  const proxyReason = proxyHealth?.reason || instance.proxyError || (
    instance.proxyEnabled && proxyHealth?.severity === "ok"
      ? t("instance.dashboard.diagnostics.proxyOperational", { defaultValue: "Proxy operacional" })
      : null
  );

  const details = [
    {
      label: t("instance.dashboard.diagnostics.instanceType", { defaultValue: "Tipo técnico" }),
      value: instanceType,
    },
    {
      label: t("instance.dashboard.diagnostics.connectionStatus", { defaultValue: "Status de conexão" }),
      value: instance.connectionStatus,
    },
    {
      label: t("instance.dashboard.diagnostics.activeClient", { defaultValue: "Cliente ativo" }),
      value: connection?.hasActiveClient,
    },
    {
      label: t("instance.dashboard.diagnostics.registered", { defaultValue: "Registrada" }),
      value: connection?.registered,
    },
    {
      label: t("instance.dashboard.diagnostics.pendingQr", { defaultValue: "QR pendente" }),
      value: connection?.hasQrCode,
    },
    {
      label: t("instance.dashboard.diagnostics.ownerJid", { defaultValue: "Owner JID" }),
      value: connection?.ownerJid || instance.ownerJid,
    },
    {
      label: t("instance.dashboard.diagnostics.proxySeverity", { defaultValue: "Severidade do proxy" }),
      value: proxyHealth?.severity,
    },
    {
      label: t("instance.dashboard.diagnostics.proxyReason", { defaultValue: "Motivo do proxy" }),
      value: proxyReason,
    },
    {
      label: t("instance.dashboard.diagnostics.softwareVersion", { defaultValue: "Versão WhatsApp" }),
      value: instance.softwareVersion,
    },
  ];

  return (
    <div className="space-y-6">
      {instance.proxyEnabled && (
        <div className="w-full">
          <ProxyStatusPanel instanceName={instance.name} />
        </div>
      )}

      <RuntimeStatsPanel instanceName={instance.name} numberFormatter={numberFormatter} />

      <Card className="border-sidebar-border bg-sidebar">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ServerCog size="18" />
            {t("instance.dashboard.diagnostics.title", { defaultValue: "Detalhes técnicos" })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {details.map((item) => (
              <div key={item.label} className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 break-all text-sm font-semibold" title={valueOrDash(item.value)}>
                  {valueOrDash(item.value)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
