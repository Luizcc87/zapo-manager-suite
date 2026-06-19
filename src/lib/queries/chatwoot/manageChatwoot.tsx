import { Chatwoot } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface IParams {
  instanceName: string;
  token: string;
  data: Chatwoot;
}

const createChatwoot = async ({ instanceName, token, data }: IParams) => {
  const response = await api.post(`/chatwoot/set/${instanceName}`, data, {
    headers: {
      apikey: token,
    },
  });
  return response.data;
};

export function useManageChatwoot() {
  const createChatwootMutation = useManageMutation(createChatwoot, {
    invalidateKeys: [["chatwoot", "fetchChatwoot"]],
  });

  return {
    createChatwoot: createChatwootMutation,
  };
}
