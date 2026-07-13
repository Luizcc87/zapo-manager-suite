import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGlobal } from "../api";

export interface EmailStatus {
  email: string | null;
  verified: boolean;
  confirmed: boolean;
}

export interface VerifyCodeResult {
  verified: boolean;
  autoVerifyFailed: boolean;
  email: string | null;
}

export function useEmailStatus(instanceName: string) {
  return useQuery({
    queryKey: ["emailStatus", instanceName],
    queryFn: async () => {
      const { data } = await apiGlobal.get<EmailStatus>(`/instance/email/status/${instanceName}`);
      return data;
    },
    enabled: !!instanceName,
    // O WhatsApp pode rejeitar (403) a IQ de e-mail para contas sem elegibilidade
    // à feature. É um erro permanente, não transitório — não faz sentido retentar.
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSetEmail(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiGlobal.post<EmailStatus>(`/instance/email/set/${instanceName}`, {
        email,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailStatus", instanceName] });
    },
  });
}

export function useRequestEmailVerificationCode(instanceName: string) {
  return useMutation({
    mutationFn: async ({ languageCode, localeCode }: { languageCode: string; localeCode: string }) => {
      const { data } = await apiGlobal.post(`/instance/email/request-code/${instanceName}`, {
        languageCode,
        localeCode,
      });
      return data;
    },
  });
}

export function useVerifyEmailCode(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiGlobal.post<VerifyCodeResult>(
        `/instance/email/verify-code/${instanceName}`,
        { code }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailStatus", instanceName] });
    },
  });
}

export function useConfirmEmail(instanceName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiGlobal.post(`/instance/email/confirm/${instanceName}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailStatus", instanceName] });
    },
  });
}
