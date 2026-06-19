/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetFlowise } from "@/lib/queries/flowise/getFlowise";
import { useManageFlowise } from "@/lib/queries/flowise/manageFlowise";

import { Flowise } from "@/types/evolution.types";

import { FlowiseForm, FormSchemaType } from "./FlowiseForm";

type UpdateFlowiseProps = {
  flowiseId: string;
  resetTable: () => void;
};

function UpdateFlowise({ flowiseId, resetTable }: UpdateFlowiseProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteFlowise, updateFlowise } = useManageFlowise();
  const { data: bot, isLoading } = useGetFlowise({
    instanceName: instance?.name,
    flowiseId,
  });

  const initialData = useMemo(
    () => ({
      enabled: bot?.enabled ?? true,
      description: bot?.description ?? "",
      apiUrl: bot?.apiUrl ?? "",
      apiKey: bot?.apiKey ?? "",
      triggerType: bot?.triggerType ?? "",
      triggerOperator: bot?.triggerOperator ?? "",
      triggerValue: bot?.triggerValue,
      expire: bot?.expire ?? 0,
      keywordFinish: bot?.keywordFinish,
      delayMessage: bot?.delayMessage ?? 0,
      unknownMessage: bot?.unknownMessage,
      listeningFromMe: bot?.listeningFromMe,
      stopBotFromMe: bot?.stopBotFromMe,
      keepOpen: bot?.keepOpen,
      debounceTime: bot?.debounceTime ?? 0,
      splitMessages: bot?.splitMessages ?? false,
      timePerChar: bot?.timePerChar ?? 0,
    }),
    [
      bot?.apiKey,
      bot?.apiUrl,
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
      bot?.unknownMessage,
      bot?.splitMessages,
      bot?.timePerChar,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && flowiseId) {
        const flowiseData: Flowise = {
          enabled: data.enabled,
          description: data.description,
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
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
          splitMessages: data.splitMessages || false,
          timePerChar: data.timePerChar || 0,
        };

        await updateFlowise({
          instanceName: instance.name,
          flowiseId,
          data: flowiseData,
        });
        toast.success(t("flowise.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/flowise/${flowiseId}`);
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
      if (instance && instance.name && flowiseId) {
        await deleteFlowise({ instanceName: instance.name, flowiseId });
        toast.success(t("flowise.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/flowise`);
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
      <FlowiseForm
        initialData={initialData}
        onSubmit={onSubmit}
        flowiseId={flowiseId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={isLoading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateFlowise };
