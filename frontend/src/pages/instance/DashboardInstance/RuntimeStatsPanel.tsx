import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Database, HardDrive, ServerCog } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useInstanceRuntimeStats } from "@/lib/queries/instance/runtimeStats";

type Props = {
  instanceName: string;
  numberFormatter: Intl.NumberFormat;
};

export function RuntimeStatsPanel({ instanceName, numberFormatter }: Props) {
  const { t } = useTranslation();
  const { data, isError } = useInstanceRuntimeStats({ instanceName });

  if (isError || !data) return null;

  return (
    <Card className="border-sidebar-border bg-sidebar">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ServerCog size="18" />
          {t("instance.dashboard.runtime.title", { defaultValue: "Diagnóstico do histórico" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              {t("instance.dashboard.runtime.memoryMessages", { defaultValue: "Mensagens em memória" })}
            </div>
            <p className="mt-1 text-xl font-semibold">{numberFormatter.format(data.memoryMessages)}</p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Database className="h-4 w-4" />
              {t("instance.dashboard.runtime.databaseMessages", { defaultValue: "Mensagens no banco" })}
            </div>
            <p className="mt-1 text-xl font-semibold">{numberFormatter.format(data.databaseMessages)}</p>
          </div>
          <div className="rounded-md border border-sidebar-border/60 bg-sidebar-accent/10 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              {t("instance.dashboard.runtime.persistence", { defaultValue: "Persistência" })}
            </div>
            <p className="mt-1 text-sm font-semibold">
              {data.databaseEnabled
                ? t("instance.dashboard.runtime.enabled", { defaultValue: "Ativa" })
                : t("instance.dashboard.runtime.disabled", { defaultValue: "Somente memória" })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
