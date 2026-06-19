import { Flowise, FlowiseSettings } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface CreateFlowiseParams {
  instanceName: string;
  token: string;
  data: Flowise;
}
const createFlowise = async ({ instanceName, token, data }: CreateFlowiseParams) => {
  const response = await api.post(`/flowise/create/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

interface UpdateFlowiseParams {
  instanceName: string;
  flowiseId: string;
  data: Flowise;
}
const updateFlowise = async ({ instanceName, flowiseId, data }: UpdateFlowiseParams) => {
  const response = await api.put(`/flowise/update/${flowiseId}/${instanceName}`, data);
  return response.data;
};

interface DeleteFlowiseParams {
  instanceName: string;
  flowiseId: string;
}
const deleteFlowise = async ({ instanceName, flowiseId }: DeleteFlowiseParams) => {
  const response = await api.delete(`/flowise/delete/${flowiseId}/${instanceName}`);
  return response.data;
};

interface ChangeStatusFlowiseParams {
  instanceName: string;
  token: string;
  remoteJid: string;
  status: string;
}
const changeStatusFlowise = async ({ instanceName, token, remoteJid, status }: ChangeStatusFlowiseParams) => {
  const response = await api.post(`/flowise/changeStatus/${instanceName}`, { remoteJid, status }, { headers: { apikey: token } });
  return response.data;
};

interface SetDefaultSettingsFlowiseParams {
  instanceName: string;
  token: string;
  data: FlowiseSettings;
}
const setDefaultSettingsFlowise = async ({ instanceName, token, data }: SetDefaultSettingsFlowiseParams) => {
  const response = await api.post(`/flowise/settings/${instanceName}`, data, {
    headers: { apikey: token },
  });
  return response.data;
};

export function useManageFlowise() {
  const setDefaultSettingsFlowiseMutation = useManageMutation(setDefaultSettingsFlowise, {
    invalidateKeys: [["flowise", "fetchDefaultSettings"]],
  });
  const changeStatusFlowiseMutation = useManageMutation(changeStatusFlowise, {
    invalidateKeys: [
      ["flowise", "getFlowise"],
      ["flowise", "fetchSessions"],
    ],
  });
  const deleteFlowiseMutation = useManageMutation(deleteFlowise, {
    invalidateKeys: [
      ["flowise", "getFlowise"],
      ["flowise", "findFlowise"],
      ["flowise", "fetchSessions"],
    ],
  });
  const updateFlowiseMutation = useManageMutation(updateFlowise, {
    invalidateKeys: [
      ["flowise", "getFlowise"],
      ["flowise", "findFlowise"],
      ["flowise", "fetchSessions"],
    ],
  });
  const createFlowiseMutation = useManageMutation(createFlowise, {
    invalidateKeys: [["flowise", "findFlowise"]],
  });

  return {
    setDefaultSettingsFlowise: setDefaultSettingsFlowiseMutation,
    changeStatusFlowise: changeStatusFlowiseMutation,
    deleteFlowise: deleteFlowiseMutation,
    updateFlowise: updateFlowiseMutation,
    createFlowise: createFlowiseMutation,
  };
}
