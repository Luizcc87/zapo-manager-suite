import { useTheme } from "@/components/theme-provider";
import { defaultAppConfig, AppConfig } from "@/config/app-config";
import { useVerifyServer } from "@/lib/queries/auth/verifyServer";
import { getProvider, getToken, TOKEN_ID } from "@/lib/queries/token";

export function useAppConfig(customConfig?: Partial<AppConfig>) {
  const { theme } = useTheme();
  const config = { ...defaultAppConfig, ...customConfig };

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const logoSrc = isDark ? config.logoDark : config.logoLight;

  const url = getToken(TOKEN_ID.API_URL);
  const provider = getProvider();
  const { data: serverInfo } = useVerifyServer({ url, enabled: !!url && provider !== "go" });

  const zapoEngineVersion = serverInfo?.zapoVersion || getToken(TOKEN_ID.ZAPO_VERSION) || "1.7.0";
  const managerVersion = serverInfo?.version && serverInfo.version !== "2.0.0" ? serverInfo.version : config.appVersion;

  return {
    ...config,
    logoSrc,
    zapoEngineVersion,
    managerVersion,
    displayVersionTag: `v${managerVersion}`,
    fullVersionTag: `v${managerVersion} (Zapo: v${zapoEngineVersion})`,
  };
}
