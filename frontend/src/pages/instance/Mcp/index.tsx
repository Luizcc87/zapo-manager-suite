import { useInstance } from "@/contexts/InstanceContext";
import { AIIntegrationCard } from "@/components/ai-integration/AIIntegrationCard";

function McpPage() {
  const { instance } = useInstance();

  return (
    <div className="w-full space-y-6">
      <div>
        <h3 className="mb-1 text-lg font-medium">Integração com Agentes de IA (MCP)</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie e conecte assistentes de IA (Claude, Cursor, Windsurf, ChatGPT, Openclaw) à sua instância do Zapo Manager através do protocolo MCP.
        </p>
      </div>

      <AIIntegrationCard apiKey={instance?.token} instanceName={instance?.name} />
    </div>
  );
}

export { McpPage };
