import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import { getToken, TOKEN_ID } from "@/lib/queries/token";

export type RuntimeStatus = {
  ok: boolean;
  clientName: string;
  version: string;
  zapoVersion?: string;
  runtimeEnvironment?: "production" | "development" | string;
  fakeServer?: {
    enabled: boolean;
    source: "env" | "runtime-file" | "default" | string;
    chatSocketUrls: string[];
    tcpUrl: string | null;
    noiseRootCaConfigured: boolean;
  };
};

async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  const apiUrl = getToken(TOKEN_ID.API_URL) || "http://localhost:8080";
  const { data } = await axios.get<RuntimeStatus>(`${apiUrl}/runtime/status`, { timeout: 3000 });
  return data;
}

export function useRuntimeStatus() {
  return useQuery({
    queryKey: ["runtime", "status"],
    queryFn: fetchRuntimeStatus,
    refetchInterval: 10000,
    retry: 1,
    staleTime: 5000,
  });
}
