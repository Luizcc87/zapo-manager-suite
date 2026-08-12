---
name: zapo-mcp-agent
description: >
  Como operar instâncias WhatsApp reais via MCP nativo do Zapo Manager
  com segurança — handoff bot/humano obrigatório antes de enviar mensagem
  automática. Trigger: qualquer tarefa que envie mensagem via MCP tools do
  Zapo Manager (send_text_message, send_media_message), "enviar mensagem
  via zapo", "usar o mcp do zapo manager", "testar agente de IA no
  whatsapp", "handoff bot humano".
---

# Operar o Zapo Manager via MCP

Este servidor MCP controla instâncias **reais** de WhatsApp. Mensagens enviadas chegam de fato ao destinatário — não é ambiente de simulação por padrão (exceto se explicitamente conectado a um sandbox dev).

## Regra obrigatória: handoff bot/humano

Toda conversa tem um `status`: `pending` | `open` | `resolved`.

- **`pending`** — ninguém assumiu ainda, ou o bot está no controle. Pode responder.
- **`open`** — um humano já assumiu pelo painel. **Não envie mensagem.** Isso não é erro, é sinal de parar.
- **`resolved`** — conversa encerrada. Não reabra sem instrução explícita do operador.

### Antes de qualquer `send_text_message`/`send_media_message` para uma conversa já existente

1. Chame `get_conversation_status(instanceName, remoteJid)`.
2. Se `status !== "pending"` — **não envie**. Relate ao usuário que a conversa está sob controle humano (ou resolvida) e pare.
3. Se `status === "pending"` — pode enviar normalmente.

O backend também bloqueia o envio no servidor (`assertBotCanSend`) mesmo se essa checagem for pulada — mas trate um erro de bloqueio como definitivo, nunca tente contornar ou repetir a chamada.

### Ao escalar para humano

Se o usuário pedir para "chamar um atendente" ou a tarefa exigir decisão humana, chame:

```
update_conversation_status(instanceName, remoteJid, "open")
```

Isso bloqueia você mesmo de continuar respondendo até um humano devolver o controle pelo painel (`PATCH /chat/:instanceName/:remoteJid/status` com `status: "pending"`).

**Nunca** defina `"open"` para você mesmo tentando reter o controle — `"open"` significa especificamente "humano no controle", não "agente ocupado".

## Tools disponíveis (referência rápida)

| Tool | Uso |
|---|---|
| `list_instances` | Lista instâncias e status de conexão |
| `get_instance_status` | Status detalhado de uma instância |
| `send_text_message` | Envia texto — **checar status antes** |
| `send_media_message` | Envia mídia — **checar status antes** |
| `list_chats` | Lista conversas recentes |
| `get_qr_or_pairing_code` | QR/código de pareamento |
| `get_conversation_status` | Consulta handoff — **chamar sempre antes de enviar** |
| `update_conversation_status` | Muda handoff (`pending`/`open`/`resolved`) |

## Como instalar (Claude Code)

Copie este arquivo para o diretório de skills do seu projeto ou global:

```bash
# Escopo do projeto
mkdir -p .claude/skills/zapo-mcp-agent
curl -o .claude/skills/zapo-mcp-agent/SKILL.md \
  https://raw.githubusercontent.com/Luizcc87/zapo-manager-suite/master/docs/skills/zapo-mcp-agent/SKILL.md

# Ou escopo global (~/.claude/skills/)
mkdir -p ~/.claude/skills/zapo-mcp-agent
curl -o ~/.claude/skills/zapo-mcp-agent/SKILL.md \
  https://raw.githubusercontent.com/Luizcc87/zapo-manager-suite/master/docs/skills/zapo-mcp-agent/SKILL.md
```

Opcional — a mesma regra já chega automaticamente via protocolo MCP (campo `instructions` do servidor nativo, ver `backend/src/mcp/server.ts`), então esta skill não é obrigatória para clientes MCP padrão. Ela ajuda quando:
- o cliente MCP usado não exibe/aplica `instructions` do servidor;
- você quer a regra disponível mesmo em tarefas que não estão conectadas ao servidor MCP no momento (ex: revisando código, escrevendo integração);
- você usa múltiplas skills/agentes e quer a regra citável por nome (`/zapo-mcp-agent` ou trigger automático).

## Referências

- Guia completo de integração (todos os clientes MCP): [`../../AI-AGENTS-MCP-INTEGRATION.md`](../../AI-AGENTS-MCP-INTEGRATION.md)
- Schema REST: [`../../openapi.yaml`](../../openapi.yaml)
- Implementação: `backend/src/services/conversationStatus.ts`, `backend/src/mcp/tools.ts`, `backend/src/mcp/server.ts`
