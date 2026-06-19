import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "./languages/en-US.json";
import esES from "./languages/es-ES.json";
import frFR from "./languages/fr-FR.json";
import ptBR from "./languages/pt-BR.json";

i18n.use(initReactI18next).init({
  resources: {
    "en-US": {
      translation: enUS,
    },
    "pt-BR": {
      translation: ptBR,
    },
    "es-ES": {
      translation: esES,
    },
    "fr-FR": {
      translation: frFR,
    },
  },
  lng: localStorage.getItem("i18nextLng") || "en-US",
  fallbackLng: "en-US",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
