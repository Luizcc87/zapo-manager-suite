import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { FindContactsResponse } from "./types";

interface IParams {
  instanceName: string;
}

const queryKey = (params: Partial<IParams>) => ["contacts", "findContacts", JSON.stringify(params)];

export const findContacts = async ({ instanceName }: IParams): Promise<FindContactsResponse> => {
  const response = await api.get(`/contact/find/${instanceName}`);
  return response.data;
};

export const useFindContacts = (props: Partial<IParams>) => {
  const { instanceName } = props;
  return useQuery<FindContactsResponse>({
    queryKey: queryKey({ instanceName }),
    queryFn: () => findContacts({ instanceName: instanceName! }),
    enabled: !!instanceName,
  });
};
