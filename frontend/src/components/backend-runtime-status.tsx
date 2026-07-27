import { Badge } from "@evoapi/design-system/badge";
import { Server, ServerOff } from "lucide-react";

import { useRuntimeStatus } from "@/lib/queries/runtime/fetchRuntimeStatus";

import { TooltipWrapper } from "./ui/tooltip";

export function BackendRuntimeStatus() {
  const { data, isError, isLoading } = useRuntimeStatus();
  const fakeEnabled = Boolean(data?.fakeServer?.enabled);

  if (isLoading) {
    return (
      <Badge variant="secondary" className="hidden items-center gap-1.5 md:inline-flex">
        <Server className="h-3.5 w-3.5" />
        Verificando backend
      </Badge>
    );
  }

  if (isError || !data?.ok) {
    return (
      <TooltipWrapper content="Backend indisponivel ou sem resposta em /runtime/status">
        <Badge variant="destructive" className="hidden items-center gap-1.5 md:inline-flex">
          <ServerOff className="h-3.5 w-3.5" />
          Offline
        </Badge>
      </TooltipWrapper>
    );
  }

  const isDevelopment = data.runtimeEnvironment === "development";
  const label = fakeEnabled
    ? "Online - Fake server"
    : isDevelopment
      ? "Online - Dev local"
      : "Online - Producao";
  const tooltip = fakeEnabled
    ? `Backend conectado em modo fake-server (${data.fakeServer?.source}). WS: ${data.fakeServer?.chatSocketUrls?.[0] ?? "n/a"}`
    : isDevelopment
      ? `Backend conectado em modo dev local, sem fake-server. Zapo: ${data.zapoVersion ?? "unknown"}`
      : `Backend conectado em modo producao. Zapo: ${data.zapoVersion ?? "unknown"}`;

  return (
    <TooltipWrapper content={tooltip}>
      <Badge variant={fakeEnabled ? "warning" : "secondary"} className="hidden items-center gap-1.5 md:inline-flex">
        <Server className="h-3.5 w-3.5" />
        {label}
      </Badge>
    </TooltipWrapper>
  );
}
