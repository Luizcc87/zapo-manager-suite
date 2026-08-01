import { Separator } from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";

import { useInstance } from "@/contexts/InstanceContext";

import { TelegramChannelPanel } from "./TelegramChannelPanel";

function Notifications() {
  const { t } = useTranslation();
  const { instance } = useInstance();

  return (
    <div className="w-full space-y-6">
      <div>
        <h3 className="mb-1 text-lg font-medium">
          {t("notifications.title", { defaultValue: "Notificações" })}
        </h3>
        <Separator className="my-4" />
      </div>

      {instance?.name && <TelegramChannelPanel instanceName={instance.name} />}
    </div>
  );
}

export { Notifications };
