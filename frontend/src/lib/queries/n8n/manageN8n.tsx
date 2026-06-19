import { N8n, N8nSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateN8nParams {
  instanceName: string;
  token: string;
  data: N8n;
}

const createN8n = async ({ instanceName, token, data }: CreateN8nParams) => {
  const response = await api.post(`/n8n/create/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface UpdateN8nParams {
  instanceName: string;
  n8nId: string;
  data: N8n;
}
const updateN8n = async ({ instanceName, n8nId, data }: UpdateN8nParams) => {
  const response = await api.put(`/n8n/update/${n8nId}/${instanceName}`, data);
  return response.data;
};

interface DeleteN8nParams {
  instanceName: string;
  n8nId: string;
}
const deleteN8n = async ({ instanceName, n8nId }: DeleteN8nParams) => {
  const response = await api.delete(`/n8n/delete/${n8nId}/${instanceName}`);
  return response.data;
};

interface SetDefaultSettingsN8nParams {
  instanceName: string;
  token: string;
  data: N8nSettings;
}
const setDefaultSettingsN8n = async ({ instanceName, token, data }: SetDefaultSettingsN8nParams) => {
  const response = await api.post(`/n8n/settings/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface ChangeStatusN8nParams {
  instanceName: string;
  token: string;
  remoteJid: string;
  status: string;
}
const changeStatusN8n = async ({ instanceName, token, remoteJid, status }: ChangeStatusN8nParams) => {
  const response = await api.post(`/n8n/changeStatus/${instanceName}`, { remoteJid, status }, { headers: { apikey: token } });
  return response.data;
};

export function useManageN8n() {
  const setDefaultSettingsN8nMutation = useManageMutation(setDefaultSettingsN8n, {
    invalidateKeys: [["n8n", "fetchDefaultSettings"]],
  });
  const changeStatusN8nMutation = useManageMutation(changeStatusN8n, {
    invalidateKeys: [
      ["n8n", "getN8n"],
      ["n8n", "fetchSessions"],
    ],
  });
  const deleteN8nMutation = useManageMutation(deleteN8n, {
    invalidateKeys: [
      ["n8n", "getN8n"],
      ["n8n", "fetchN8n"],
      ["n8n", "fetchSessions"],
    ],
  });
  const updateN8nMutation = useManageMutation(updateN8n, {
    invalidateKeys: [
      ["n8n", "getN8n"],
      ["n8n", "fetchN8n"],
      ["n8n", "fetchSessions"],
    ],
  });
  const createN8nMutation = useManageMutation(createN8n, {
    invalidateKeys: [["n8n", "fetchN8n"]],
  });

  return {
    setDefaultSettingsN8n: setDefaultSettingsN8nMutation,
    changeStatusN8n: changeStatusN8nMutation,
    deleteN8n: deleteN8nMutation,
    updateN8n: updateN8nMutation,
    createN8n: createN8nMutation,
  };
}
