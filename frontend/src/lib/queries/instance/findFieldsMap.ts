import { useQuery } from '@tanstack/react-query';
import { apiGlobal } from '../api';

export const GET_FIELDS_MAP_KEY = 'get_fields_map';

export type FieldMapInput = {
  slotKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
};

export async function fetchFieldsMap(instanceName: string): Promise<{ fields: FieldMapInput[] }> {
  const { data } = await apiGlobal.get(`/instance/fields-map/${instanceName}`);
  return data;
}

export function useGetFieldsMap(instanceName: string | undefined) {
  return useQuery({
    queryKey: [GET_FIELDS_MAP_KEY, instanceName],
    queryFn: () => fetchFieldsMap(instanceName!),
    enabled: !!instanceName,
  });
}
