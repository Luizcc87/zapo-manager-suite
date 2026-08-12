import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { api } from '../api';
import { GET_LEAD_KEY } from './findLead';

interface UpdateLeadPayload {
  instanceName: string;
  remoteJid: string;
  fields: Record<string, any>;
  actor: { type: 'human' | 'agent' | 'webhook'; id: string };
}

export function useUpdateLead() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateLeadPayload) => {
      const { data } = await api.patch(
        `/chat/${payload.instanceName}/${encodeURIComponent(payload.remoteJid)}/lead`,
        { fields: payload.fields, actor: payload.actor }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [GET_LEAD_KEY, variables.instanceName, variables.remoteJid],
      });
      toast.success(t('chat.leadUpdated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('chat.leadUpdateError'));
    },
  });
}
