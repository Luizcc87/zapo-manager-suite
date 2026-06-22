import { Badge } from "@evoapi/design-system/badge";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent } from "@evoapi/design-system/card";
import { FlaskConical, Globe, ShieldCheck, ShieldAlert, Settings, SquareMousePointer, Smartphone, Trash2, KeyRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { TestInteractiveModal } from "@/components/test-interactive-modal";

import { Instance } from "@/types/evolution.types";

const StatusBadge = ({ status }: { status?: string }) => {
  const { t } = useTranslation();
  if (status === "open") return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">{t("status.open")}</Badge>;
  if (status === "connecting") return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">{t("status.connecting")}</Badge>;
  return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">{t("status.closed")}</Badge>;
};

const formatOwnerJid = (ownerJid: string) => ownerJid.split("@")[0].split(":")[0];

const ProxyBadge = ({ enabled, connected }: { enabled?: boolean; connected?: boolean }) => {
  if (!enabled) {
    return (
      <Badge className="gap-1 bg-muted text-muted-foreground hover:bg-muted/80" title="Proxy desativado">
        <ShieldCheck className="h-3 w-3" />
        <span className="font-mono text-[10px]"><span className="hidden sm:inline">Proxy </span>—</span>
      </Badge>
    );
  }
  if (connected === false) {
    return (
      <Badge className="gap-1 bg-red-500/10 text-red-500 hover:bg-red-500/20" title="Proxy configurado mas falhou na conexão">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] font-semibold"><span className="hidden sm:inline">Proxy </span>ERR</span>
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" title="Proxy ativo e conectado">
      <ShieldCheck className="h-3 w-3" />
      <span className="font-mono text-[10px] font-semibold"><span className="hidden sm:inline">Proxy </span>OK</span>
    </Badge>
  );
};

const WebhookBadge = ({ enabled }: { enabled?: boolean }) => {
  if (!enabled) {
    return (
      <Badge className="gap-1 bg-muted text-muted-foreground hover:bg-muted/80" title="Webhook desativado">
        <SquareMousePointer className="h-3 w-3" />
        <span className="font-mono text-[10px]"><span className="hidden sm:inline">Webhook </span>OFF</span>
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20" title="Webhook ativo">
      <SquareMousePointer className="h-3 w-3" />
      <span className="font-mono text-[10px] font-semibold"><span className="hidden sm:inline">Webhook </span>ON</span>
    </Badge>
  );
};

interface InstanceCardProps {
  instance: Instance;
  isDeleting?: boolean;
  onDelete: (instance: Instance) => void;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="WhatsApp">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export function InstanceCard({ instance, isDeleting, onDelete }: InstanceCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [testOpen, setTestOpen] = useState(false);
  const numberFormatter = new Intl.NumberFormat(i18n.language);
  const displayName = instance.profileName || instance.name;
  const goToInstance = () => navigate(`/manager/instance/${instance.id}/dashboard`);
  const canTest = instance.connectionStatus === "open";

  return (
    <Card className="group relative overflow-hidden border-sidebar-border bg-sidebar transition-all duration-300 hover:bg-sidebar-accent/30 hover:shadow-lg hover:shadow-black/10">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={goToInstance}
          className="flex w-full items-center gap-3 border-b border-sidebar-border p-4 text-left"
        >
          {instance.profilePicUrl ? (
            <div className="flex-shrink-0">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-muted">
                <img
                  src={instance.profilePicUrl}
                  alt={displayName}
                  className="h-12 w-12 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-lg font-semibold text-emerald-500 dark:text-emerald-400">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 truncate text-base font-semibold text-sidebar-foreground">
                <span className="truncate">{displayName}</span>
                {instance.profileName && <WhatsAppIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#25D366]" />}
              </h3>
            <p className="truncate text-xs text-sidebar-foreground/60">{instance.name}</p>
          </div>

          <div className="flex-shrink-0">
            <StatusBadge status={instance.connectionStatus} />
          </div>
        </button>

        <div className="space-y-1 px-4 py-3 text-xs text-sidebar-foreground/70">
          <div className="flex flex-wrap gap-2 pb-2">
            <ProxyBadge enabled={!!instance.proxyEnabled} connected={instance.proxyConnected} />
            <WebhookBadge enabled={!!instance.webhookEnabled} />
            {(() => {
              const isPrimary = instance.instanceType === "primary";
              const isMobile = isPrimary || instance.instanceType === "mobile" || !!instance.mobileTransport;
              if (isPrimary) {
                return (
                  <Badge className="bg-violet-500/10 text-violet-500 hover:bg-violet-500/20">
                    <span className="mr-1 inline-flex items-center"><KeyRound className="h-3 w-3" /></span>
                    {t("instance.type.primary", { defaultValue: "Primário" })}
                  </Badge>
                );
              }
              if (isMobile) {
                return (
                  <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                    <span className="mr-1 inline-flex items-center"><Smartphone className="h-3 w-3" /></span>
                    {t("instance.type.mobile", { defaultValue: "Mobile" })}
                  </Badge>
                );
              }
              return (
                <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                  <span className="mr-1 inline-flex items-center"><Globe className="h-3 w-3" /></span>
                  {t("instance.type.web", { defaultValue: "Web" })}
                </Badge>
              );
            })()}
          </div>
          {instance.ownerJid && (
            <div className="flex items-center justify-between">
              <span>{t("dashboard.card.phone", { defaultValue: "Número" })}</span>
              <span className="ml-2 truncate font-mono">{formatOwnerJid(instance.ownerJid)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>{t("instance.dashboard.contacts")}</span>
            <span className="font-mono">{numberFormatter.format(instance._count?.Contact || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("instance.dashboard.messages")}</span>
            <span className="font-mono">{numberFormatter.format(instance._count?.Message || 0)}</span>
          </div>
        </div>

        <div className="flex border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="h-12 flex-1 rounded-none text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={goToInstance}
          >
            <Settings className="mr-2 h-4 w-4" />
            {t("dashboard.settings")}
          </Button>
          <div className="w-px bg-sidebar-border" />
          <Button
            variant="ghost"
            className="h-12 rounded-none px-4 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            disabled={!canTest}
            title={canTest ? t("testInteractive.title") : t("testInteractive.requiresOpen")}
            onClick={() => setTestOpen(true)}
          >
            <FlaskConical className="h-4 w-4" />
          </Button>
          <div className="w-px bg-sidebar-border" />
          <Button
            variant="ghost"
            className="h-12 rounded-none px-4 text-red-500 hover:bg-red-500/10 hover:text-red-400"
            disabled={isDeleting}
            onClick={() => onDelete(instance)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <TestInteractiveModal instance={instance} open={testOpen} onOpenChange={setTestOpen} />
    </Card>
  );
}
