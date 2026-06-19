import { EvolutionBot, EvolutionBotSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateEvolutionBotParams {
  instanceName: string;
  token?: string;
  data: EvolutionBot;
}

const createEvolutionBot = async ({ instanceName, token, data }: CreateEvolutionBotParams) => {
  const response = await api.post(`/evolutionBot/create/${instanceName}`, data, { headers: { apikey: token } });
  return response.data;
};

interface UpdateEvolutionBotParams extends CreateEvolutionBotParams {
  evolutionBotId: string;
}

const updateEvolutionBot = async ({ instanceName, token, evolutionBotId, data }: UpdateEvolutionBotParams) => {
  const response = await api.put(`/evolutionBot/update/${evolutionBotId}/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface DeleteEvolutionBotParams {
  instanceName: string;
  evolutionBotId: string;
}
const deleteEvolutionBot = async ({ instanceName, evolutionBotId }: DeleteEvolutionBotParams) => {
  const response = await api.delete(`/evolutionBot/delete/${evolutionBotId}/${instanceName}`);
  return response.data;
};

interface SetDefaultSettingsEvolutionBotParams {
  instanceName: string;
  token: string;
  data: EvolutionBotSettings;
}
const setDefaultSettingsEvolutionBot = async ({ instanceName, token, data }: SetDefaultSettingsEvolutionBotParams) => {
  const response = await api.post(`/evolutionBot/settings/${instanceName}`, data, { headers: { apikey: token } });
  return response.data;
};

interface ChangeStatusEvolutionBotParams {
  instanceName: string;
  token: string;
  remoteJid: string;
  status: string;
}
const changeStatusEvolutionBot = async ({ instanceName, token, remoteJid, status }: ChangeStatusEvolutionBotParams) => {
  const response = await api.post(
    `/evolutionBot/changeStatus/${instanceName}`,
    {
      remoteJid,
      status,
    },
    { headers: { apikey: token } },
  );
  return response.data;
};

export function useManageEvolutionBot() {
  const setDefaultSettingsEvolutionBotMutation = useManageMutation(setDefaultSettingsEvolutionBot, {
    invalidateKeys: [["evolutionBot", "fetchDefaultSettings"]],
  });
  const changeStatusEvolutionBotMutation = useManageMutation(changeStatusEvolutionBot, {
    invalidateKeys: [
      ["evolutionBot", "getEvolutionBot"],
      ["evolutionBot", "fetchSessions"],
    ],
  });
  const deleteEvolutionBotMutation = useManageMutation(deleteEvolutionBot, {
    invalidateKeys: [
      ["evolutionBot", "getEvolutionBot"],
      ["evolutionBot", "findEvolutionBot"],
      ["evolutionBot", "fetchSessions"],
    ],
  });
  const updateEvolutionBotMutation = useManageMutation(updateEvolutionBot, {
    invalidateKeys: [
      ["evolutionBot", "getEvolutionBot"],
      ["evolutionBot", "findEvolutionBot"],
      ["evolutionBot", "fetchSessions"],
    ],
  });
  const createEvolutionBotMutation = useManageMutation(createEvolutionBot, {
    invalidateKeys: [["evolutionBot", "findEvolutionBot"]],
  });

  return {
    setDefaultSettingsEvolutionBot: setDefaultSettingsEvolutionBotMutation,
    changeStatusEvolutionBot: changeStatusEvolutionBotMutation,
    deleteEvolutionBot: deleteEvolutionBotMutation,
    updateEvolutionBot: updateEvolutionBotMutation,
    createEvolutionBot: createEvolutionBotMutation,
  };
}
