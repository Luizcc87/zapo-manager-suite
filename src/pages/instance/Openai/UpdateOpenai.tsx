/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetOpenai } from "@/lib/queries/openai/getOpenai";
import { useManageOpenai } from "@/lib/queries/openai/manageOpenai";

import { Openai } from "@/types/evolution.types";

import { OpenaiForm, FormSchemaType } from "./OpenaiForm";

type UpdateOpenaiProps = {
  openaiId: string;
  resetTable: () => void;
};

function UpdateOpenai({ openaiId, resetTable }: UpdateOpenaiProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteOpenai, updateOpenai } = useManageOpenai();
  const { data: openai, isLoading } = useGetOpenai({
    instanceName: instance?.name,
    openaiId,
  });

  const initialData = useMemo(
    () => ({
      enabled: openai?.enabled ?? true,
      description: openai?.description ?? "",
      openaiCredsId: openai?.openaiCredsId ?? "",
      botType: openai?.botType ?? "",
      assistantId: openai?.assistantId || "",
      functionUrl: openai?.functionUrl || "",
      model: openai?.model || "",
      systemMessages: Array.isArray(openai?.systemMessages) ? openai?.systemMessages.join(", ") : openai?.systemMessages || "",
      assistantMessages: Array.isArray(openai?.assistantMessages) ? openai?.assistantMessages.join(", ") : openai?.assistantMessages || "",
      userMessages: Array.isArray(openai?.userMessages) ? openai?.userMessages.join(", ") : openai?.userMessages || "",
      maxTokens: openai?.maxTokens || 0,
      triggerType: openai?.triggerType || "",
      triggerOperator: openai?.triggerOperator || "",
      triggerValue: openai?.triggerValue,
      expire: openai?.expire || 0,
      keywordFinish: openai?.keywordFinish,
      delayMessage: openai?.delayMessage || 0,
      unknownMessage: openai?.unknownMessage,
      listeningFromMe: openai?.listeningFromMe,
      stopBotFromMe: openai?.stopBotFromMe,
      keepOpen: openai?.keepOpen,
      debounceTime: openai?.debounceTime || 0,
      splitMessages: openai?.splitMessages || false,
      timePerChar: openai?.timePerChar || 0,
    }),
    [
      openai?.assistantId,
      openai?.assistantMessages,
      openai?.botType,
      openai?.debounceTime,
      openai?.delayMessage,
      openai?.description,
      openai?.enabled,
      openai?.expire,
      openai?.functionUrl,
      openai?.keepOpen,
      openai?.keywordFinish,
      openai?.listeningFromMe,
      openai?.maxTokens,
      openai?.model,
      openai?.openaiCredsId,
      openai?.stopBotFromMe,
      openai?.systemMessages,
      openai?.triggerOperator,
      openai?.triggerType,
      openai?.triggerValue,
      openai?.unknownMessage,
      openai?.userMessages,
      openai?.splitMessages,
      openai?.timePerChar,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && openaiId) {
        const openaiData: Openai = {
          enabled: data.enabled,
          description: data.description,
          openaiCredsId: data.openaiCredsId,
          botType: data.botType,
          assistantId: data.assistantId || "",
          functionUrl: data.functionUrl || "",
          model: data.model || "",
          systemMessages: [data.systemMessages || ""],
          assistantMessages: [data.assistantMessages || ""],
          userMessages: [data.userMessages || ""],
          maxTokens: data.maxTokens || 0,
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

        await updateOpenai({
          instanceName: instance.name,
          openaiId,
          data: openaiData,
        });
        toast.success(t("openai.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/openai/${openaiId}`);
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
      if (instance && instance.name && openaiId) {
        await deleteOpenai({ instanceName: instance.name, openaiId });
        toast.success(t("openai.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/openai`);
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
      <OpenaiForm
        initialData={initialData}
        onSubmit={onSubmit}
        openaiId={openaiId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={isLoading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateOpenai };
