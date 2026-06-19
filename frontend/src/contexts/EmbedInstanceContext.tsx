import axios from "axios";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { TOKEN_ID } from "@/lib/queries/token";

import { Instance } from "@/types/evolution.types";

interface EmbedInstanceContextType {
  instance: Instance | null;
  isLoading: boolean;
  error: string | null;
}

const EmbedInstanceContext = createContext<EmbedInstanceContextType>({
  instance: null,
  isLoading: true,
  error: null,
});

export function EmbedInstanceProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAndFetchInstance = async () => {
      const token = searchParams.get("token");
      const instanceName = searchParams.get("instanceName");
      const apiUrl = searchParams.get("apiUrl");

      if (!token || !instanceName || !apiUrl) {
        setError("Token, instanceName e apiUrl são obrigatórios");
        setIsLoading(false);
        return;
      }

      try {
        // Format URL (remove trailing slash if present)
        const formattedUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
        localStorage.setItem(TOKEN_ID.API_URL, formattedUrl);
        localStorage.setItem(TOKEN_ID.INSTANCE_TOKEN, token);

        const { data } = await axios.get(`${formattedUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          headers: {
            apikey: token,
          },
        });

        console.log("API Response:", data);

        // API returns an array with the instance object
        if (data && Array.isArray(data) && data.length > 0) {
          setInstance(data[0]); // Get the first (and only) instance
        } else {
          setError("Instância não encontrada");
        }
      } catch (err) {
        setError("Erro ao validar token ou buscar instância");
      } finally {
        setIsLoading(false);
      }
    };

    validateAndFetchInstance();
  }, [searchParams]);

  return <EmbedInstanceContext.Provider value={{ instance, isLoading, error }}>{children}</EmbedInstanceContext.Provider>;
}

export const useEmbedInstance = () => useContext(EmbedInstanceContext);
