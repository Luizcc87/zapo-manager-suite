import { Sqs } from "@/types/evolution.types";

import { api } from "../api";
import { useManageMutation } from "../mutateQuery";

interface IParams {
  instanceName: string;
  token: string;
  data: Sqs;
}

const createSqs = async ({ instanceName, token, data }: IParams) => {
  const response = await api.post(`/sqs/set/${instanceName}`, { sqs: data }, { headers: { apikey: token } });
  return response.data;
};

export function useManageSqs() {
  const createSqsMutation = useManageMutation(createSqs, {
    invalidateKeys: [["sqs", "fetchSqs"]],
  });

  return {
    createSqs: createSqsMutation,
  };
}
