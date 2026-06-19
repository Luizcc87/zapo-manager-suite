import { Typebot, TypebotSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateTypebotParams {
  instanceName: string;
  token?: string;
  data: Typebot;
}

const createTypebot = async ({ instanceName, token, data }: CreateTypebotParams) => {
  const response = await api.post(`/typebot/create/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface UpdateTypebotParams extends CreateTypebotParams {
  typebotId: string;
}

const updateTypebot = async ({ instanceName, token, typebotId, data }: UpdateTypebotParams) => {
  const response = await api.put(`/typebot/update/${typebotId}/${instanceName}`, data, { headers: { apikey: token } });
  return response.data;
};

interface DeleteTypebotParams {
  instanceName: string;
  typebotId: string;
}
const deleteTypebot = async ({ instanceName, typebotId }: DeleteTypebotParams) => {
  const response = await api.delete(`/typebot/delete/${typebotId}/${instanceName}`);
  return response.data;
};

interface SetDefaultSettingsTypebotParams {
  instanceName: string;
  token: string;
  data: TypebotSettings;
}
const setDefaultSettingsTypebot = async ({ instanceName, token, data }: SetDefaultSettingsTypebotParams) => {
  const response = await api.post(`/typebot/settings/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface ChangeStatusTypebotParams {
  instanceName: string;
  token: string;
  remoteJid: string;
  status: string;
}
const changeStatusTypebot = async ({ instanceName, token, remoteJid, status }: ChangeStatusTypebotParams) => {
  const response = await api.post(
    `/typebot/changeStatus/${instanceName}`,
    {
      remoteJid,
      status,
    },
    { headers: { apikey: token } },
  );
  return response.data;
};

export function useManageTypebot() {
  const setDefaultSettingsTypebotMutation = useManageMutation(setDefaultSettingsTypebot, {
    invalidateKeys: [["typebot", "fetchDefaultSettings"]],
  });
  const changeStatusTypebotMutation = useManageMutation(changeStatusTypebot, {
    invalidateKeys: [
      ["typebot", "getTypebot"],
      ["typebot", "fetchSessions"],
    ],
  });
  const deleteTypebotMutation = useManageMutation(deleteTypebot, {
    invalidateKeys: [
      ["typebot", "getTypebot"],
      ["typebot", "findTypebot"],
      ["typebot", "fetchSessions"],
    ],
  });
  const updateTypebotMutation = useManageMutation(updateTypebot, {
    invalidateKeys: [
      ["typebot", "getTypebot"],
      ["typebot", "findTypebot"],
      ["typebot", "fetchSessions"],
    ],
  });
  const createTypebotMutation = useManageMutation(createTypebot, {
    invalidateKeys: [["typebot", "findTypebot"]],
  });

  return {
    setDefaultSettingsTypebot: setDefaultSettingsTypebotMutation,
    changeStatusTypebot: changeStatusTypebotMutation,
    deleteTypebot: deleteTypebotMutation,
    updateTypebot: updateTypebotMutation,
    createTypebot: createTypebotMutation,
  };
}
