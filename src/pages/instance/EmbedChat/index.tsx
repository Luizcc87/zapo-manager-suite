// Bibliotecas externas
import { QueryClientProvider } from "@tanstack/react-query";

// Componentes UI
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Contexts
import { EmbedColorsProvider } from "@/contexts/EmbedColorsContext";
import { EmbedInstanceProvider, useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { InstanceProvider } from "@/contexts/InstanceContext";
// import { WebPhoneProvider } from "@/contexts/Webphone";

// Configurações
// eslint-disable-next-line import-helpers/order-imports
import { queryClient } from "@/lib/queries/react-query";
// import { defaultConfig } from "@/services/config";

// Componentes
import { EmbedChatMessage } from "../EmbedChatMessage";

/**
 * Componente responsável por carregar e validar a instância do chat embedado
 */
function EmbedChatContent() {
  const { instance, isLoading, error } = useEmbedInstance();

  // Renderização condicional
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900">
          <span className="text-red-800 dark:text-red-200">{error}</span>
        </div>
      </div>
    );
  }

  if (!instance) {
    return null;
  }

  // Renderização do componente principal do chat
  return (
    <div className="h-screen">
      <EmbedChatMessage />
    </div>
  );
}

/**
 * Componente principal que fornece os providers necessários para o chat embedado
 */
function EmbedChat() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* <WebPhoneProvider defaultConfig={defaultConfig}> */}
      <InstanceProvider>
        <EmbedInstanceProvider>
          <EmbedColorsProvider>
            <EmbedChatContent />
          </EmbedColorsProvider>
        </EmbedInstanceProvider>
      </InstanceProvider>
      {/* </WebPhoneProvider> */}
    </QueryClientProvider>
  );
}

export { EmbedChat };
