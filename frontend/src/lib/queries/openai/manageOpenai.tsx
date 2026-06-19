import { Openai, OpenaiCreds, OpenaiSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateOpenaiCredsParams {
  instanceName: string;
  token?: string;
  data: OpenaiCreds;
}
const createOpenaiCreds = async ({ instanceName, token, data }: CreateOpenaiCredsParams) => {
  const response = await api.post(`/openai/creds/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface DeleteOpenaiCredsParams {
  openaiCredsId: string;
  instanceName: string;
}
const deleteOpenaiCreds = async ({ openaiCredsId, instanceName }: DeleteOpenaiCredsParams) => {
  const response = await api.delete(`/openai/creds/${openaiCredsId}/${instanceName}`);
  return response.data;
};

interface CreateOpenaiParams {
  instanceName: string;
  token?: string;
  data: Openai;
}
const createOpenai = async ({ instanceName, token, data }: CreateOpenaiParams) => {
  const response = await api.post(`/openai/create/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface UpdateOpenaiParams {
  instanceName: string;
  token?: string;
  openaiId: string;
  data: Openai;
}
const updateOpenai = async ({ instanceName, token, openaiId, data }: UpdateOpenaiParams) => {
  const response = await api.put(`/openai/update/${openaiId}/${instanceName}`, data, { headers: { apikey: token } });
  return response.data;
};

interface DeleteOpenaiParams {
  instanceName: string;
  token?: string;
  openaiId: string;
}
const deleteOpenai = async ({ instanceName, token, openaiId }: DeleteOpenaiParams) => {
  const response = await api.delete(`/openai/delete/${openaiId}/${instanceName}`, { headers: { apikey: token } });
  return response.data;
};

interface SetDefaultSettingsOpenaiParams {
  instanceName: string;
  token?: string;
  data: OpenaiSettings;
}
const setDefaultSettingsOpenai = async ({ instanceName, token, data }: SetDefaultSettingsOpenaiParams) => {
  const response = await api.post(`/openai/settings/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface ChangeStatusOpenaiParams {
  instanceName: string;
  token?: string;
  remoteJid: string;
  status: string;
}
const changeStatusOpenai = async ({ instanceName, token, remoteJid, status }: ChangeStatusOpenaiParams) => {
  const response = await api.post(`/openai/changeStatus/${instanceName}`, { remoteJid, status }, { headers: { apikey: token } });
  return response.data;
};

export function useManageOpenai() {
  const setDefaultSettingsOpenaiMutation = useManageMutation(setDefaultSettingsOpenai, {
    invalidateKeys: [["openai", "fetchDefaultSettings"]],
  });
  const changeStatusOpenaiMutation = useManageMutation(changeStatusOpenai, {
    invalidateKeys: [
      ["openai", "getOpenai"],
      ["openai", "fetchSessions"],
    ],
  });
  const deleteOpenaiMutation = useManageMutation(deleteOpenai, {
    invalidateKeys: [
      ["openai", "getOpenai"],
      ["openai", "findOpenai"],
      ["openai", "fetchSessions"],
    ],
  });
  const updateOpenaiMutation = useManageMutation(updateOpenai, {
    invalidateKeys: [
      ["openai", "getOpenai"],
      ["openai", "findOpenai"],
      ["openai", "fetchSessions"],
    ],
  });
  const createOpenaiMutation = useManageMutation(createOpenai, {
    invalidateKeys: [["openai", "findOpenai"]],
  });
  const createOpenaiCredsMutation = useManageMutation(createOpenaiCreds, {
    invalidateKeys: [["openai", "findOpenaiCreds"]],
  });
  const deleteOpenaiCredsMutation = useManageMutation(deleteOpenaiCreds, {
    invalidateKeys: [["openai", "findOpenaiCreds"]],
  });

  return {
    setDefaultSettingsOpenai: setDefaultSettingsOpenaiMutation,
    changeStatusOpenai: changeStatusOpenaiMutation,
    deleteOpenai: deleteOpenaiMutation,
    updateOpenai: updateOpenaiMutation,
    createOpenai: createOpenaiMutation,
    createOpenaiCreds: createOpenaiCredsMutation,
    deleteOpenaiCreds: deleteOpenaiCredsMutation,
  };
}
