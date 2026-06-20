import { Badge } from "@evoapi/design-system/badge";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent } from "@evoapi/design-system/card";
import { FlaskConical, Globe, ShieldCheck, Settings, SquareMousePointer, Smartphone, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

const FlagBadge = ({
  active,
  activeLabel,
  inactiveLabel,
  activeClassName,
  inactiveClassName,
  activeIcon,
  inactiveIcon,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeClassName: string;
  inactiveClassName: string;
  activeIcon: ReactNode;
  inactiveIcon: ReactNode;
}) => {
  return active ? (
    <Badge className={activeClassName}>
      <span className="mr-1 inline-flex items-center">{activeIcon}</span>
      {activeLabel}
    </Badge>
  ) : (
    <Badge className={inactiveClassName}>
      <span className="mr-1 inline-flex items-center">{inactiveIcon}</span>
      {inactiveLabel}
    </Badge>
  );
};

interface InstanceCardProps {
  instance: Instance;
  isDeleting?: boolean;
  onDelete: (instance: Instance) => void;
}

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
            <h3 className="truncate text-base font-semibold text-sidebar-foreground">{displayName}</h3>
            <p className="truncate text-xs text-sidebar-foreground/60">{instance.name}</p>
          </div>

          <div className="flex-shrink-0">
            <StatusBadge status={instance.connectionStatus} />
          </div>
        </button>

        <div className="space-y-1 px-4 py-3 text-xs text-sidebar-foreground/70">
          <div className="flex flex-wrap gap-2 pb-2">
            <FlagBadge
              active={!!instance.proxyEnabled}
              activeLabel={t("proxy.badge.active")}
              inactiveLabel={t("proxy.badge.inactive", { defaultValue: "Proxy desativado" })}
              activeClassName="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
              inactiveClassName="bg-muted text-muted-foreground hover:bg-muted/80"
              activeIcon={<ShieldCheck className="h-3 w-3" />}
              inactiveIcon={<ShieldCheck className="h-3 w-3" />}
            />
            <FlagBadge
              active={!!instance.webhookEnabled}
              activeLabel={t("webhook.status.active", { defaultValue: "Webhook ativo" })}
              inactiveLabel={t("webhook.status.inactive", { defaultValue: "Webhook desativado" })}
              activeClassName="bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
              inactiveClassName="bg-muted text-muted-foreground hover:bg-muted/80"
              activeIcon={<SquareMousePointer className="h-3 w-3" />}
              inactiveIcon={<SquareMousePointer className="h-3 w-3" />}
            />
            <FlagBadge
              active={(instance.instanceType ?? (instance.mobileTransport ? "mobile" : "web")) === "mobile"}
              activeLabel={t("instance.type.mobile", { defaultValue: "Mobile" })}
              inactiveLabel={t("instance.type.web", { defaultValue: "Web" })}
              activeClassName="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              inactiveClassName="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              activeIcon={<Smartphone className="h-3 w-3" />}
              inactiveIcon={<Globe className="h-3 w-3" />}
            />
          </div>
          {instance.ownerJid && (
            <div className="flex items-center justify-between">
              <span>{t("dashboard.card.phone", { defaultValue: "Número" })}</span>
              <span className="ml-2 truncate font-mono">{instance.ownerJid.split("@")[0]}</span>
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
