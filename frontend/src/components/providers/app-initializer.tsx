import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { getToken, TOKEN_ID } from "@/lib/queries/token";

interface AppInitializerProps {
  children: React.ReactNode;
}

export function AppInitializer({ children }: AppInitializerProps) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const checkDefaultLanguage = async () => {
      // Se o usuário já tiver escolhido um idioma no localStorage, não faz nada
      if (localStorage.getItem("i18nextLng")) {
        return;
      }

      const apiUrl = getToken(TOKEN_ID.API_URL);
      const defaultServerUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_EVOLUTION_API_URL || (
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "8080"
          ? `${window.location.protocol}//${window.location.hostname}:8080`
          : window.location.protocol + "//" + window.location.host
      );

      const targetUrl = apiUrl || defaultServerUrl;
      try {
        const response = await axios.get(`${targetUrl.replace(/\/+$/, "")}/`);
        if (response.data?.defaultLanguage) {
          const defaultLang = response.data.defaultLanguage;
          // Valida se o idioma recebido é suportado antes de aplicar
          const supportedLanguages = ["pt-BR", "en-US", "es-ES", "fr-FR"];
          if (supportedLanguages.includes(defaultLang)) {
            i18n.changeLanguage(defaultLang);
            localStorage.setItem("i18nextLng", defaultLang);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch default language from server:", err);
      }
    };

    checkDefaultLanguage();
  }, [i18n]);

  return <>{children}</>;
}
