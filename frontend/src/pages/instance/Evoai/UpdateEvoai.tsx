/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetEvoai } from "@/lib/queries/evoai/getEvoai";
import { useManageEvoai } from "@/lib/queries/evoai/manageEvoai";

import { Evoai } from "@/types/evolution.types";

import { EvoaiForm, FormSchemaType } from "./EvoaiForm";

type UpdateEvoaiProps = {
  evoaiId: string;
  resetTable: () => void;
};

function UpdateEvoai({ evoaiId, resetTable }: UpdateEvoaiProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteEvoai, updateEvoai } = useManageEvoai();
  const { data: evoai, isLoading: loading } = useGetEvoai({
    evoaiId,
    instanceName: instance?.name,
  });

  const initialData = useMemo(
    () => ({
      enabled: !!evoai?.enabled,
      description: evoai?.description ?? "",
      agentUrl: evoai?.agentUrl ?? "",
      apiKey: evoai?.apiKey ?? "",
      triggerType: evoai?.triggerType ?? "",
      triggerOperator: evoai?.triggerOperator ?? "",
      triggerValue: evoai?.triggerValue ?? "",
      expire: evoai?.expire ?? 0,
      keywordFinish: evoai?.keywordFinish ?? "",
      delayMessage: evoai?.delayMessage ?? 0,
      unknownMessage: evoai?.unknownMessage ?? "",
      listeningFromMe: !!evoai?.listeningFromMe,
      stopBotFromMe: !!evoai?.stopBotFromMe,
      keepOpen: !!evoai?.keepOpen,
      debounceTime: evoai?.debounceTime ?? 0,
      splitMessages: evoai?.splitMessages ?? false,
      timePerChar: evoai?.timePerChar ?? 0,
    }),
    [
      evoai?.agentUrl,
      evoai?.apiKey,
      evoai?.debounceTime,
      evoai?.delayMessage,
      evoai?.description,
      evoai?.enabled,
      evoai?.expire,
      evoai?.keepOpen,
      evoai?.keywordFinish,
      evoai?.listeningFromMe,
      evoai?.stopBotFromMe,
      evoai?.triggerOperator,
      evoai?.triggerType,
      evoai?.triggerValue,
      evoai?.unknownMessage,
      evoai?.splitMessages,
      evoai?.timePerChar,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && evoaiId) {
        const evoaiData: Evoai = {
          enabled: data.enabled,
          description: data.description,
          agentUrl: data.agentUrl,
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

        await updateEvoai({
          instanceName: instance.name,
          evoaiId,
          data: evoaiData,
        });
        toast.success(t("evoai.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/evoai/${evoaiId}`);
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
      if (instance && instance.name && evoaiId) {
        await deleteEvoai({ instanceName: instance.name, evoaiId });
        toast.success(t("evoai.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/evoai`);
      } else {
        console.error("instance not found");
      }
    } catch (error) {
      console.error("Erro ao excluir evoai:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="m-4">
      <EvoaiForm
        initialData={initialData}
        onSubmit={onSubmit}
        evoaiId={evoaiId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={loading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateEvoai };
