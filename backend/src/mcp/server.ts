import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpTools, McpContext } from './tools';

/**
 * Instruções enviadas ao cliente MCP na inicialização (campo `instructions` do protocolo).
 * Todo agente autônomo (Hermes Agent, OpenClaw, Claude, etc.) que conectar neste servidor
 * recebe este texto — é o lugar certo para regra de comportamento, não só descrição de tool.
 */
const SERVER_INSTRUCTIONS = `
Este servidor controla instâncias reais de WhatsApp via Zapo Manager. Mensagens enviadas chegam de fato ao destinatário.

REGRA OBRIGATÓRIA — handoff bot/humano:
Antes de enviar QUALQUER mensagem automática (send_text_message, send_media_message) para uma conversa
já iniciada, chame get_conversation_status(instanceName, remoteJid) primeiro.
- status "pending" → você pode responder normalmente.
- status "open" → um humano já assumiu esta conversa. NÃO envie mensagem. Pare e aguarde.
- status "resolved" → conversa encerrada. Não reabra sem instrução explícita do operador.

O backend também bloqueia o envio quando o status não é "pending" (dupla trava), mas a checagem prévia
evita que você gaste uma chamada e receba um erro — trate esse erro como sinal definitivo de parar,
nunca como algo a contornar ou repetir.

Ao escalar uma conversa para um humano (ex: cliente pediu atendente, ou você não sabe responder),
chame update_conversation_status(instanceName, remoteJid, "open") — isso bloqueia você mesmo de
continuar respondendo até um humano devolver o controle.

Nunca defina status "open" para si mesmo tentando manter o controle — "open" significa especificamente
"humano no controle". Para você mesmo continuar operando após pausa, use "pending".
`.trim();

export function createMcpServer(context: McpContext) {
  const server = new McpServer(
    {
      name: 'zapo-manager-server',
      version: process.env.APP_VERSION || '1.6.24',
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  for (const tool of mcpTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.paramsSchema.shape as any,
      async (args: any) => {
        try {
          const result = await tool.execute(args, context);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: err.message || 'Internal MCP tool execution error' }),
              },
            ],
          };
        }
      }
    );
  }

  return server;
}
