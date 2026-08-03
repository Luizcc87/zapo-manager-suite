export interface AppConfig {
  appName: string;
  appVersion: string;
  appDescription: string;
  logoDark: string;
  logoLight: string;
  copyrightOwner: string;
  githubUrl: string;
  docsUrl: string;
  apiDocsUrl: string;
}

export const defaultAppConfig: AppConfig = {
  appName: import.meta.env.VITE_APP_NAME || "Zapo Manager",
  appVersion: import.meta.env.VITE_APP_VERSION || "1.6.19",
  appDescription: import.meta.env.VITE_APP_DESCRIPTION || "Painel de gerenciamento para a Zapo API",
  logoDark: import.meta.env.VITE_APP_LOGO_DARK || "/assets/images/zapo-manager-logo.svg",
  logoLight: import.meta.env.VITE_APP_LOGO_LIGHT || "/assets/images/zapo-manager-logo-light.svg",
  copyrightOwner: import.meta.env.VITE_APP_COPYRIGHT || "Zapo Manager",
  githubUrl: import.meta.env.VITE_APP_GITHUB_URL || "https://github.com/Luizcc87/zapo-manager-suite",
  docsUrl: import.meta.env.VITE_APP_DOCS_URL || "https://github.com/vinikjkkj/zapo",
  apiDocsUrl: import.meta.env.VITE_APP_API_DOCS_URL || "/api-docs",
};
