import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGlobal } from "../api";

export interface CompanionRecord {
  deviceJid: string;
  keyIndex: number;
  addedAtSeconds: number;
}

export function useCompanions(instanceName: string) {
  return useQuery({
    queryKey: ["companions", instanceName],
    queryFn: async () => {
      const { data } = await apiGlobal.get<{ companions: CompanionRecord[] }>(
        `/instance/companion/list/${instanceName}`
      );
      return data.companions;
    },
    enabled: !!instanceName,
  });
}

export function useLinkCompanion(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mode, value }: { mode: "qr" | "code"; value: string }) => {
      const { data } = await apiGlobal.post(`/instance/companion/link/${instanceName}`, {
        mode,
        value,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companions", instanceName] });
    },
  });
}

export function useRevokeCompanion(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceJid, reason }: { deviceJid: string; reason?: string }) => {
      const { data } = await apiGlobal.delete(`/instance/companion/revoke/${instanceName}`, {
        data: { deviceJid, reason },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companions", instanceName] });
    },
  });
}

export function useRevokeAllCompanions(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ excludeHostedCompanion }: { excludeHostedCompanion: boolean }) => {
      const { data } = await apiGlobal.delete(
        `/instance/companion/revoke-all/${instanceName}?excludeHostedCompanion=${excludeHostedCompanion}`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companions", instanceName] });
    },
  });
}

export function useReconcileCompanions(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiGlobal.post(`/instance/companion/reconcile/${instanceName}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companions", instanceName] });
    },
  });
}
