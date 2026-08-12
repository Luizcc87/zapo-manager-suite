import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { apiGlobal } from '../api';
import { GET_FIELDS_MAP_KEY, FieldMapInput } from './findFieldsMap';

interface UpdateFieldsMapPayload {
  instanceName: string;
  fields: FieldMapInput[];
}

export function useUpdateFieldsMap() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateFieldsMapPayload) => {
      const { data } = await apiGlobal.patch(`/instance/fields-map/${payload.instanceName}`, {
        fields: payload.fields,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [GET_FIELDS_MAP_KEY, variables.instanceName],
      });
      toast.success(t('instance.settings.fieldsMapUpdated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('instance.settings.fieldsMapUpdateError'));
    },
  });
}
