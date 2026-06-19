/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useGetN8n } from "@/lib/queries/n8n/getN8n";
import { useManageN8n } from "@/lib/queries/n8n/manageN8n";

import { N8n } from "@/types/evolution.types";

import { N8nForm, FormSchemaType } from "./N8nForm";

type UpdateN8nProps = {
  n8nId: string;
  resetTable: () => void;
};

function UpdateN8n({ n8nId, resetTable }: UpdateN8nProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const navigate = useNavigate();
  const [openDeletionDialog, setOpenDeletionDialog] = useState<boolean>(false);

  const { deleteN8n, updateN8n } = useManageN8n();
  const { data: n8n, isLoading: loading } = useGetN8n({
    n8nId,
    instanceName: instance?.name,
  });

  const initialData = useMemo(
    () => ({
      enabled: !!n8n?.enabled,
      description: n8n?.description ?? "",
      webhookUrl: n8n?.webhookUrl ?? "",
      basicAuthUser: n8n?.basicAuthUser ?? "",
      basicAuthPass: n8n?.basicAuthPass ?? "",
      triggerType: n8n?.triggerType ?? "",
      triggerOperator: n8n?.triggerOperator ?? "",
      triggerValue: n8n?.triggerValue ?? "",
      expire: n8n?.expire ?? 0,
      keywordFinish: n8n?.keywordFinish ?? "",
      delayMessage: n8n?.delayMessage ?? 0,
      unknownMessage: n8n?.unknownMessage ?? "",
      listeningFromMe: !!n8n?.listeningFromMe,
      stopBotFromMe: !!n8n?.stopBotFromMe,
      keepOpen: !!n8n?.keepOpen,
      debounceTime: n8n?.debounceTime ?? 0,
      splitMessages: n8n?.splitMessages ?? false,
      timePerChar: n8n?.timePerChar ?? 0,
    }),
    [
      n8n?.webhookUrl,
      n8n?.basicAuthUser,
      n8n?.basicAuthPass,
      n8n?.debounceTime,
      n8n?.delayMessage,
      n8n?.description,
      n8n?.enabled,
      n8n?.expire,
      n8n?.keepOpen,
      n8n?.keywordFinish,
      n8n?.listeningFromMe,
      n8n?.stopBotFromMe,
      n8n?.triggerOperator,
      n8n?.triggerType,
      n8n?.triggerValue,
      n8n?.unknownMessage,
      n8n?.splitMessages,
      n8n?.timePerChar,
    ],
  );

  const onSubmit = async (data: FormSchemaType) => {
    try {
      if (instance && instance.name && n8nId) {
        const n8nData: N8n = {
          enabled: data.enabled,
          description: data.description,
          webhookUrl: data.webhookUrl,
          basicAuthUser: data.basicAuthUser,
          basicAuthPass: data.basicAuthPass,
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

        await updateN8n({
          instanceName: instance.name,
          n8nId,
          data: n8nData,
        });
        toast.success(t("n8n.toast.success.update"));
        resetTable();
        navigate(`/manager/instance/${instance.id}/n8n/${n8nId}`);
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
      if (instance && instance.name && n8nId) {
        await deleteN8n({ instanceName: instance.name, n8nId });
        toast.success(t("n8n.toast.success.delete"));

        setOpenDeletionDialog(false);
        resetTable();
        navigate(`/manager/instance/${instance.id}/n8n`);
      } else {
        console.error("instance not found");
      }
    } catch (error) {
      console.error("Erro ao excluir n8n:", error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="m-4">
      <N8nForm
        initialData={initialData}
        onSubmit={onSubmit}
        n8nId={n8nId}
        handleDelete={handleDelete}
        isModal={false}
        isLoading={loading}
        openDeletionDialog={openDeletionDialog}
        setOpenDeletionDialog={setOpenDeletionDialog}
      />
    </div>
  );
}

export { UpdateN8n };
