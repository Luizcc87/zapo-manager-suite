import { Rabbitmq } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface IParams {
  instanceName: string;
  token: string;
  data: Rabbitmq;
}

const createRabbitmq = async ({ instanceName, token, data }: IParams) => {
  const response = await api.post(`/rabbitmq/set/${instanceName}`, { rabbitmq: data }, { headers: { apikey: token } });
  return response.data;
};

export function useManageRabbitmq() {
  const createRabbitmqMutation = useManageMutation(createRabbitmq, {
    invalidateKeys: [["rabbitmq", "fetchRabbitmq"]],
  });

  return {
    createRabbitmq: createRabbitmqMutation,
  };
}
