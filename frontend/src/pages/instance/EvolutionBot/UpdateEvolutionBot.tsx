/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetEvolutionBot } from "@/lib/queries/evolutionBot/getEvolutionBot";
import { useManageEvolutionBot } from "@/lib/queries/evolutionBot/manageEvolutionBot";

import { EvolutionBot } from "@/types/evolution.types";

import { EvolutionBotForm, FormSchemaType } from "./EvolutionBotForm";

type UpdateEvolutionBotProps = {
  evolutionBotId: string;
  resetTable: () => void;
};

function UpdateEvolutionBot({ evolutionBotId, resetTable }: UpdateEvolutionBotProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteEvolutionBot, updateEvolutionBot } = useManageEvolutionBot();
  const { data: bot, isLoading } = useGetEvolutionBot({
    instanceName: instance?.name,
    evolutionBotId,
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
      stopBotFromMe: !!bot?.stopBotFromMe,
      keepOpen: !!bot?.keepOpen,
      debounceTime: bot?.debounceTime ?? 0,
      splitMessages: bot?.splitMessages ?? false,
      timePerChar: bot?.timePerChar ? bot?.timePerChar : 0,
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
      if (instance && instance.name && evolutionBotId) {
        const evolutionBotData: EvolutionBot = {
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
          timePerChar: data.timePerChar ? data.timePerChar : 0,
        };

        await updateEvolutionBot({
          instanceName: instance.name,
          evolutionBotId,
          data: evolutionBotData,
        });
        toast.success(t("evolutionBot.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/evolutionBot/${evolutionBotId}`);
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
      if (instance && instance.name && evolutionBotId) {
        await deleteEvolutionBot({
          instanceName: instance.name,
          evolutionBotId,
        });
        toast.success(t("evolutionBot.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/evolutionBot`);
      } else {
        console.error("instance not found");
      }
    } catch (error) {
      console.error("Erro ao excluir evolutionBot:", error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="m-4">
      <EvolutionBotForm
        initialData={initialData}
        onSubmit={onSubmit}
        evolutionBotId={evolutionBotId}
        handleDelete={handleDelete}
        isModal={false}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateEvolutionBot };
