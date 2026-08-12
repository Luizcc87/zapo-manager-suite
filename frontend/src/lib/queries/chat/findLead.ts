import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Instance } from '@/types/evolution.types';

export const GET_LEAD_KEY = 'get_lead';

export async function fetchLead(instanceName: string, remoteJid: string, raw = false) {
  const { data } = await api.get<Record<string, any>>(
    `/chat/${instanceName}/${encodeURIComponent(remoteJid)}/lead`,
    { params: raw ? { raw: 'true' } : undefined }
  );
  return data;
}

/** Valores resolvidos por label (`{"Empresa": "Acme"}`) — leitura/exibição. */
export function useGetLead(instance: Instance | undefined, remoteJid: string | undefined) {
  return useQuery({
    queryKey: [GET_LEAD_KEY, instance?.name, remoteJid],
    queryFn: () => fetchLead(instance!.name, remoteJid!),
    enabled: !!instance?.name && !!remoteJid,
  });
}

/** Valores brutos por slotKey (`{"field01": "Acme"}`) — uso em formulário editável. */
export function useGetLeadRaw(instance: Instance | undefined, remoteJid: string | undefined) {
  return useQuery({
    queryKey: [GET_LEAD_KEY, 'raw', instance?.name, remoteJid],
    queryFn: () => fetchLead(instance!.name, remoteJid!, true),
    enabled: !!instance?.name && !!remoteJid,
  });
}
