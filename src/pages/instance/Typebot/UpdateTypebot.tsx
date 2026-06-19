/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetTypebot } from "@/lib/queries/typebot/getTypebot";
import { useManageTypebot } from "@/lib/queries/typebot/manageTypebot";

import { Typebot } from "@/types/evolution.types";

import { TypebotForm, FormSchemaType } from "./TypebotForm";

type UpdateTypebotProps = {
  typebotId: string;
  resetTable: () => void;
};

function UpdateTypebot({ typebotId, resetTable }: UpdateTypebotProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteTypebot, updateTypebot } = useManageTypebot();
  const { data: bot, isLoading } = useGetTypebot({
    instanceName: instance?.name,
    typebotId,
  });
  const initialData = useMemo(
    () => ({
      enabled: !!bot?.enabled,
      description: bot?.description ?? "",
      url: bot?.url ?? "",
      typebot: bot?.typebot ?? "",
      triggerType: bot?.triggerType ?? "",
      triggerOperator: bot?.triggerOperator ?? "",
      triggerValue: bot?.triggerValue,
      expire: bot?.expire ?? 0,
      keywordFinish: bot?.keywordFinish,
      delayMessage: bot?.delayMessage ?? 0,
      unknownMessage: bot?.unknownMessage,
      listeningFromMe: !!bot?.listeningFromMe,
      stopBotFromMe: !!bot?.stopBotFromMe,
      keepOpen: !!bot?.keepOpen,
      debounceTime: bot?.debounceTime ?? 0,
    }),
    [
      bot?.debounceTime,
      bot?.delayMessage,
      bot?.description,
      bot?.enabled,
      bot?.expire,
      bot?.keepOpen,
      bot?.keywordFinish,
      bot?.listeningFromMe,
      bot?.stopBotFromMe,
      bot?.triggerOperator,
      bot?.triggerType,
      bot?.triggerValue,
      bot?.typebot,
      bot?.unknownMessage,
      bot?.url,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && typebotId) {
        const typebotData: Typebot = {
          enabled: data.enabled,
          description: data.description,
          url: data.url,
          typebot: data.typebot || "",
          triggerType: data.triggerType,
          triggerOperator: data.triggerOperator || "",
          triggerValue: data.triggerValue || "",
          expire: data.expire || 0,
          keywordFinish: data.keywordFinish || "",
          delayMessage: data.delayMessage || 1000,
          unknownMessage: data.unknownMessage || "",
          listeningFromMe: data.listeningFromMe || false,
          stopBotFromMe: data.stopBotFromMe || false,
          keepOpen: data.keepOpen || false,
          debounceTime: data.debounceTime || 0,
        };

        await updateTypebot({
          instanceName: instance.name,
          typebotId,
          data: typebotData,
        });
        toast.success(t("typebot.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/typebot/${typebotId}`);
      } else {
        console.error("Token not found");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(`Error: ${error?.response?.data?.response?.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      if (instance && instance.name && typebotId) {
        await deleteTypebot({ instanceName: instance.name, typebotId });
        toast.success(t("typebot.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/typebot`);
      } else {
        console.error("instance not found");
      }
    } catch (error) {
      console.error("Erro ao excluir dify:", error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="m-4">
      <TypebotForm
        initialData={initialData}
        onSubmit={onSubmit}
        typebotId={typebotId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={isLoading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateTypebot };
