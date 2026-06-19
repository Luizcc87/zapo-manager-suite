/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetDify } from "@/lib/queries/dify/getDify";
import { useManageDify } from "@/lib/queries/dify/manageDify";

import { Dify } from "@/types/evolution.types";

import { DifyForm, FormSchemaType } from "./DifyForm";

type UpdateDifyProps = {
  difyId: string;
  resetTable: () => void;
};

function UpdateDify({ difyId, resetTable }: UpdateDifyProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteDify, updateDify } = useManageDify();
  const { data: dify, isLoading: loading } = useGetDify({
    difyId,
    instanceName: instance?.name,
  });

  const initialData = useMemo(
    () => ({
      enabled: !!dify?.enabled,
      description: dify?.description ?? "",
      botType: dify?.botType ?? "",
      apiUrl: dify?.apiUrl ?? "",
      apiKey: dify?.apiKey ?? "",
      triggerType: dify?.triggerType ?? "",
      triggerOperator: dify?.triggerOperator ?? "",
      triggerValue: dify?.triggerValue ?? "",
      expire: dify?.expire ?? 0,
      keywordFinish: dify?.keywordFinish ?? "",
      delayMessage: dify?.delayMessage ?? 0,
      unknownMessage: dify?.unknownMessage ?? "",
      listeningFromMe: !!dify?.listeningFromMe,
      stopBotFromMe: !!dify?.stopBotFromMe,
      keepOpen: !!dify?.keepOpen,
      debounceTime: dify?.debounceTime ?? 0,
      splitMessages: dify?.splitMessages ?? false,
      timePerChar: dify?.timePerChar ?? 0,
    }),
    [
      dify?.apiKey,
      dify?.apiUrl,
      dify?.botType,
      dify?.debounceTime,
      dify?.delayMessage,
      dify?.description,
      dify?.enabled,
      dify?.expire,
      dify?.keepOpen,
      dify?.keywordFinish,
      dify?.listeningFromMe,
      dify?.stopBotFromMe,
      dify?.triggerOperator,
      dify?.triggerType,
      dify?.triggerValue,
      dify?.unknownMessage,
      dify?.splitMessages,
      dify?.timePerChar,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && difyId) {
        const difyData: Dify = {
          enabled: data.enabled,
          description: data.description,
          botType: data.botType,
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

        await updateDify({
          instanceName: instance.name,
          difyId,
          data: difyData,
        });
        toast.success(t("dify.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/dify/${difyId}`);
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
      if (instance && instance.name && difyId) {
        await deleteDify({ instanceName: instance.name, difyId });
        toast.success(t("dify.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/dify`);
      } else {
        console.error("instance not found");
      }
    } catch (error) {
      console.error("Erro ao excluir dify:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="m-4">
      <DifyForm
        initialData={initialData}
        onSubmit={onSubmit}
        difyId={difyId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={loading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateDify };
