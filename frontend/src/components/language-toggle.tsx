import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@evoapi/design-system/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";

export function LanguageToggle() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    localStorage.setItem("i18nextLng", lng);
    void i18n.changeLanguage(lng);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
          <span className="sr-only">{t("header.theme.label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className={i18n.language === "pt-BR" ? "font-bold" : ""} onSelect={() => changeLanguage("pt-BR")}>
          {t("header.language.portuguese")}
        </DropdownMenuItem>
        <DropdownMenuItem className={i18n.language === "en-US" ? "font-bold" : ""} onSelect={() => changeLanguage("en-US")}>
          {t("header.language.english")}
        </DropdownMenuItem>
        <DropdownMenuItem className={i18n.language === "es-ES" ? "font-bold" : ""} onSelect={() => changeLanguage("es-ES")}>
          {t("header.language.spanish")}
        </DropdownMenuItem>
        <DropdownMenuItem className={i18n.language === "fr-FR" ? "font-bold" : ""} onSelect={() => changeLanguage("fr-FR")}>
          {t("header.language.french")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
