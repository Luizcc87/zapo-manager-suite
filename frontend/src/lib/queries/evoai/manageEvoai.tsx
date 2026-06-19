import { Evoai, EvoaiSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateEvoaiParams {
  instanceName: string;
  token: string;
  data: Evoai;
}

const createEvoai = async ({ instanceName, token, data }: CreateEvoaiParams) => {
  const response = await api.post(`/evoai/create/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface UpdateEvoaiParams {
  instanceName: string;
  evoaiId: string;
  data: Evoai;
}
const updateEvoai = async ({ instanceName, evoaiId, data }: UpdateEvoaiParams) => {
  const response = await api.put(`/evoai/update/${evoaiId}/${instanceName}`, data);
  return response.data;
};

interface DeleteEvoaiParams {
  instanceName: string;
  evoaiId: string;
}
const deleteEvoai = async ({ instanceName, evoaiId }: DeleteEvoaiParams) => {
  const response = await api.delete(`/evoai/delete/${evoaiId}/${instanceName}`);
  return response.data;
};

interface SetDefaultSettingsEvoaiParams {
  instanceName: string;
  token: string;
  data: EvoaiSettings;
}
const setDefaultSettingsEvoai = async ({ instanceName, token, data }: SetDefaultSettingsEvoaiParams) => {
  const response = await api.post(`/evoai/settings/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface ChangeStatusEvoaiParams {
  instanceName: string;
  token: string;
  remoteJid: string;
  status: string;
}
const changeStatusEvoai = async ({ instanceName, token, remoteJid, status }: ChangeStatusEvoaiParams) => {
  const response = await api.post(`/evoai/changeStatus/${instanceName}`, { remoteJid, status }, { headers: { apikey: token } });
  return response.data;
};

export function useManageEvoai() {
  const setDefaultSettingsEvoaiMutation = useManageMutation(setDefaultSettingsEvoai, {
    invalidateKeys: [["evoai", "fetchDefaultSettings"]],
  });
  const changeStatusEvoaiMutation = useManageMutation(changeStatusEvoai, {
    invalidateKeys: [
      ["evoai", "getEvoai"],
      ["evoai", "fetchSessions"],
    ],
  });
  const deleteEvoaiMutation = useManageMutation(deleteEvoai, {
    invalidateKeys: [
      ["evoai", "getEvoai"],
      ["evoai", "fetchEvoai"],
      ["evoai", "fetchSessions"],
    ],
  });
  const updateEvoaiMutation = useManageMutation(updateEvoai, {
    invalidateKeys: [
      ["evoai", "getEvoai"],
      ["evoai", "fetchEvoai"],
      ["evoai", "fetchSessions"],
    ],
  });
  const createEvoaiMutation = useManageMutation(createEvoai, {
    invalidateKeys: [["evoai", "fetchEvoai"]],
  });

  return {
    setDefaultSettingsEvoai: setDefaultSettingsEvoaiMutation,
    changeStatusEvoai: changeStatusEvoaiMutation,
    deleteEvoai: deleteEvoaiMutation,
    updateEvoai: updateEvoaiMutation,
    createEvoai: createEvoaiMutation,
  };
}
