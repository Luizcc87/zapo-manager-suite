import { useTranslation } from "react-i18next";

interface ButtonMessagePreviewProps {
  title: string;
  description: string;
  footer?: string;
  buttons: Array<{
    type: string;
    displayText: string;
  }>;
}

const ButtonMessagePreview = ({ title, description, footer = "", buttons }: ButtonMessagePreviewProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center space-y-2">
      <h4 className="font-medium text-black dark:text-white">{t("chat.buttons.preview.title")}</h4>

      {/* Container principal simulando a bolha do WhatsApp */}
      <div className="min-w-[280px] max-w-[320px] rounded-lg bg-[#c8fff2] shadow-md dark:bg-[#0b332a]">
        {/* Conteúdo da mensagem */}
        <div className="space-y-1 p-3">
          {title && <div className="break-words font-semibold text-black dark:text-white">{title}</div>}
          {description && <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words text-sm text-black dark:text-white">{description}</div>}
          {footer && <div className="break-words text-xs text-gray-600 dark:text-gray-300">{footer}</div>}
        </div>

        {/* Separador */}
        {buttons.length > 0 && <div className="h-[1px] bg-black/10 dark:bg-white/10" />}

        {/* Botões */}
        <div className="flex flex-col">
          {buttons.map((button, index) => (
            <div key={index} className="flex flex-col">
              {index > 0 && <div className="h-[1px] bg-black/10 dark:bg-white/10" />}
              <button className="break-words p-3 text-center text-sm font-medium text-[#008069] transition-colors hover:bg-[#b2ece0] dark:text-[#00a884] dark:hover:bg-[#082720]">
                {button.displayText || t("chat.buttons.preview.buttonPlaceholder")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { ButtonMessagePreview };
