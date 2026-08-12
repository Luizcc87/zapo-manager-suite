# Integração com Agentes de IA — Zapo Manager (MCP & LLM)

Este guia consolida os caminhos de integração do **Zapo Manager** e do ecossistema **Zapo** com agentes de IA (Claude, Cursor, ChatGPT, Hermes Agent, Openclaw e similares).

> **Fontes primárias (não duplicamos o conteúdo — linkamos):**
> - Documentação de IA da Zapo: [`docs/zapo/use-with-ai.md`](./zapo/use-with-ai.md)
> - Ferramentas de desenvolvimento MCP/Fake: [`docs/zapo/dev-tools.md`](./zapo/dev-tools.md)

---

## ⚖️ Servidores MCP — objetivos e endpoints

| | **Docs MCP** | **Nativo Zapo Manager MCP (Novo!)** | **Live WaClient Dev MCP** |
|---|---|---|---|
| **Endpoint** | `https://zapo.to/mcp` | `https://sua-vps.com/mcp` ou `/mcp/:apiKey` | `npx -y @zapo-js/mcp-server` |
| **O que faz** | Leitura da documentação oficial Zapo | Gerencia instâncias, envia msgs e consulta chats via Zapo Manager | Controla um `WaClient` dev diretamente |
| **Segurança** | ✅ Somente leitura | 🛡️ Protegido por `apikey` / `Bearer` | ⚠️ **DEV/SANDBOX ONLY** |
| **Uso em Produção** | Sim | Sim (com sua GLOBAL_API_KEY) | Não |

### ⚡ Ferramentas nativas expostas no Servidor MCP (`/mcp`):
1. `list_instances`: Lista todas as instâncias e seus status no banco e runtime.
2. `get_instance_status`: Retorna o status operacional detalhado de uma instância.
3. `send_text_message`: Envia mensagem de texto via instância conectada.
4. `send_media_message`: Envia imagem, documento, áudio, vídeo ou sticker via URL.
5. `list_chats`: Lista chats e conversas recentes de uma instância.
6. `get_qr_or_pairing_code`: Retorna o QR Code ou código de 8 dígitos para pareamento.
7. `get_conversation_status`: Consulta o status de handoff bot/humano (`pending`/`open`/`resolved`) de uma conversa — **chame antes de enviar mensagem automática**. Se o status não for `pending`, um humano já assumiu; não envie.
8. `update_conversation_status`: Atualiza o status de handoff. Use `pending` para devolver o controle ao bot, ou `resolved` para encerrar. Não defina `open` a menos que o agente esteja de fato escalando para um humano.

> **Handoff bot/humano:** todo agente autônomo (Hermes Agent, OpenClaw, etc.) que enviar mensagens automáticas deve consultar `get_conversation_status` antes de responder. O backend também bloqueia o envio via `assertBotCanSend` quando o status não é `pending` — a checagem do agente é uma segunda camada, não a única.

> **Onde isso vive:** o servidor MCP nativo (`backend/src/mcp/server.ts`) envia essas mesmas regras no campo `instructions` da resposta de inicialização MCP — qualquer cliente compatível com o protocolo recebe a orientação automaticamente, sem precisar copiar texto de um doc. As seções abaixo documentam o fluxo para quem está integrando manualmente ou revisando comportamento esperado.
>
> **Skill opcional para Claude Code:** [`docs/skills/zapo-mcp-agent/SKILL.md`](./skills/zapo-mcp-agent/SKILL.md) — mesma regra empacotada como skill instalável (`curl` + copiar para `.claude/skills/`), útil quando o `instructions` do protocolo não é suficiente (cliente MCP que não aplica, ou tarefa sem conexão MCP ativa no momento).

### 🔄 Fluxo de comportamento esperado (handoff)

Todo agente que envia mensagens automáticas via `send_text_message`/`send_media_message` deve seguir este ciclo:

1. **Antes de responder** uma conversa já iniciada: chame `get_conversation_status(instanceName, remoteJid)`.
2. **Se `status: "pending"`** — pode responder normalmente.
3. **Se `status: "open"`** — um humano já assumiu. **Não envie.** Pare silenciosamente (não é erro, é comportamento esperado).
4. **Se `status: "resolved"`** — conversa encerrada. Não reabra sem instrução explícita do operador.
5. **Ao escalar para humano** (cliente pediu atendente, ou o agente não sabe responder): chame `update_conversation_status(instanceName, remoteJid, "open")`. Isso bloqueia o próprio agente de continuar respondendo até um humano devolver o controle pelo painel.
6. **Se o envio for rejeitado pelo backend** (erro de `assertBotCanSend`) mesmo após checar o status: trate como sinal definitivo de parar — nunca repita a chamada ou tente contornar.

**Nunca** defina `status: "open"` para o próprio agente tentando reter o controle — `"open"` significa especificamente "humano no controle". Para pausar e depois retomar como agente, use `"pending"`.

**Exemplo de prompt/instrução para configurar num agente externo (Hermes Agent, OpenClaw, etc.):**

> "Antes de responder qualquer mensagem de WhatsApp, chame a tool `get_conversation_status`. Se o status retornado não for `pending`, não envie nada — um humano já está atendendo essa conversa. Quando precisar escalar para um atendente humano, chame `update_conversation_status` com `status: 'open'`."


---

## 🚀 Configuração rápida (Zero Config)

O repositório já inclui `.mcp.json` na raiz com ambos os servidores pré-configurados. Clientes compatíveis com o padrão de auto-descoberta MCP carregam automaticamente.

Para **ativar o Live WaClient MCP localmente**, copie o arquivo de exemplo do Cursor:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

> ⚠️ `.cursor/mcp.json.example` existe propositalmente como *exemplo*, não como config ativa, para evitar ativação acidental contra contas reais.

---

## 🤖 Claude Code CLI

### 1. Docs MCP (recomendado — seguro para qualquer workflow)

```bash
# Escopo do projeto (recomendado)
claude mcp add zapo-docs --scope project --transport http https://zapo.to/mcp

# Escopo global (disponível em qualquer projeto)
claude mcp add zapo-docs --scope user --transport http https://zapo.to/mcp
```

### 2. Live WaClient MCP (somente dev/sandbox)

```bash
# Via npx — sem instalação local necessária
claude mcp add zapo-live --scope project -- npx -y @zapo-js/mcp-server@^1.2.0
```

Variáveis de ambiente relevantes (passar via `--env` ou definir no shell):

| Variável | Padrão | Descrição |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | `stdio` ou `http` |
| `MCP_SESSION_ID` | `default_2` | Nome da sessão do WaClient |
| `MCP_AUTH_PATH` | `./.auth/state.sqlite` | Caminho do store SQLite de credenciais |
| `MCP_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` |
| `MCP_HTTP_PORT` | `3737` | Porta do servidor HTTP (se `MCP_TRANSPORT=http`) |

### 3. Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "zapo-docs": {
      "type": "http",
      "url": "https://zapo.to/mcp"
    },
    "zapo-live-dev": {
      "command": "npx",
      "args": ["-y", "@zapo-js/mcp-server@^1.2.0"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MCP_SESSION_ID": "dev-session",
        "MCP_AUTH_PATH": "/caminho/absoluto/.auth/mcp-state.sqlite",
        "NODE_ENV": "development"
      }
    }
  }
}
```

---

## 💻 Cursor IDE

Copie `.cursor/mcp.json.example` para `.cursor/mcp.json` na raiz do projeto:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

Ou adicione manualmente ao seu `~/.cursor/mcp.json` (escopo global):

```json
{
  "mcpServers": {
    "zapo-docs": {
      "url": "https://zapo.to/mcp"
    }
  }
}
```

**Prompt recomendado no Cursor (via @zapo-docs):**

> "Consulte o servidor zapo-docs para entender o evento `auth_qr` antes de editar qualquer rota de pairing no backend."

---

## 🌊 Windsurf (Codeium)

Windsurf usa o arquivo `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "zapo-docs": {
      "serverUrl": "https://zapo.to/mcp"
    }
  }
}
```

---

## 🧩 VS Code (via Continue ou Cline)

### Continue

Adicione ao `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "zapo-docs",
      "transport": {
        "type": "http",
        "url": "https://zapo.to/mcp"
      }
    }
  ]
}
```

### Cline

Acesse **Settings → MCP Servers → Add Server** e informe:
- **Name:** `zapo-docs`
- **Type:** SSE / HTTP
- **URL:** `https://zapo.to/mcp`

---

## 🧠 ChatGPT / Custom GPTs (OpenAI)

O ChatGPT e Custom GPTs **não suportam MCP nativo** (protocolo proprietário). Use os caminhos alternativos:

### Opção A — llms.txt (mais simples)

Cole o conteúdo abaixo como contexto do GPT ou no início do prompt:

| Arquivo | URL | Conteúdo |
|---|---|---|
| Índice | `https://zapo.to/llms.txt` | Títulos e resumos de cada página (pequeno, ideal para colar) |
| Corpus completo | `https://zapo.to/llms-full.txt` | Todo o conteúdo (grande, para RAG ou context window ampla) |

**Prompt exemplo:**

> "Acesse `https://zapo.to/llms-full.txt` e use como contexto para responder perguntas sobre a API Zapo."

### Opção B — OpenAI Actions (Custom GPT com chamadas de API)

Use o arquivo [`docs/openapi.yaml`](./openapi.yaml) do Zapo Manager como schema de Actions no seu Custom GPT:

1. Acesse [platform.openai.com → GPT Builder](https://platform.openai.com/gpts)
2. Em **"Actions"**, clique **"Import from URL"** e aponte para sua instância do `zapo-manager` ou para o arquivo exportado.
3. Configure os headers de autenticação (`apikey`) no painel de Actions.

Isso permite ao Custom GPT chamar sua instância do Zapo Manager diretamente (listar instâncias, verificar status, enviar mensagens via API REST).

---

## 🐺 Hermes Agent

**Hermes Agent** suporta MCP via stdio e HTTP. Configure os servidores no arquivo de configuração do seu agente (ex: `hermes.config.json` ou via CLI):

### Via stdio (recomendado para Live MCP)

```json
{
  "mcpServers": {
    "zapo-docs": {
      "type": "http",
      "url": "https://zapo.to/mcp"
    },
    "zapo-live-dev": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zapo-js/mcp-server@^1.2.0"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MCP_SESSION_ID": "hermes-dev",
        "MCP_AUTH_PATH": "./.auth/hermes-mcp.sqlite",
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Via API REST (sem MCP)

Se o Hermes Agent operar via HTTP/REST sem suporte a MCP, use o endpoint do Zapo Manager diretamente com o schema de [`docs/openapi.yaml`](./openapi.yaml) como referência.

---

## 🦅 Openclaw

**Openclaw** suporta chamadas MCP e OpenAPI Actions. Registre os servidores via sua interface:

### Docs MCP (HTTP)

- **Tipo:** MCP HTTP
- **URL:** `https://zapo.to/mcp`
- **Auth:** Nenhuma (público)

### Live WaClient MCP (stdio)

- **Tipo:** MCP stdio
- **Comando:** `npx -y @zapo-js/mcp-server@^1.2.0`
- **Variáveis de ambiente:**
  ```
  MCP_TRANSPORT=stdio
  MCP_SESSION_ID=openclaw-dev
  MCP_AUTH_PATH=./.auth/openclaw-mcp.sqlite
  NODE_ENV=development
  ```

### Via OpenAPI Actions

Importe o schema [`docs/openapi.yaml`](./openapi.yaml) como uma Action no Openclaw para chamar sua instância do Zapo Manager via REST.

---

## 🤖 Agentes CLI e Frameworks Autônomos Genéricos

Para frameworks como **AutoGen, CrewAI, LangGraph, n8n (AI Nodes), LlamaIndex, Dify**, etc.:

### Protocolo MCP padrão

A maioria dos frameworks já suporta o [Model Context Protocol](https://modelcontextprotocol.io). Registre o servidor HTTP:

```
https://zapo.to/mcp
```

Para o Live WaClient, use o comando stdio e passe as variáveis de ambiente `MCP_*` conforme a tabela acima.

### llms.txt como contexto estático

Se o framework não suporta MCP, carregue o corpus via URL:

```python
# Exemplo Python / LangChain
import requests
docs = requests.get("https://zapo.to/llms-full.txt").text
# Use `docs` como contexto de RAG ou system prompt
```

### REST via OpenAPI

Use o [`docs/openapi.yaml`](./openapi.yaml) para gerar clients ou registrar tools no framework:

```python
# Exemplo LangChain OpenAPIAgent
from langchain.agents.agent_toolkits import create_openapi_agent
# Aponte para docs/openapi.yaml do seu Zapo Manager deployado
```

---

## 🔒 Boas Práticas e Segurança

> [!CAUTION]
> O `@zapo-js/mcp-server` expõe controle total sobre uma conta WhatsApp real ao agente de IA. Nunca registre o Live WaClient MCP contra contas de produção ou clientes. Use exclusivamente com contas sandbox/testes.

> [!WARNING]
> Um agente com acesso ao Live MCP pode enviar mensagens, alterar estado, revogar credenciais e executar qualquer chamada da API Zapo. Restrinja o escopo de `MCP_SESSION_ID` e `MCP_AUTH_PATH` a ambientes isolados.

> [!TIP]
> Combine o **Docs MCP** (`zapo.to/mcp`) com o **Live MCP** para workflows de *"leia o que o evento significa na doc e depois dispare-o na sessão real"* — conforme recomendado em [`docs/zapo/use-with-ai.md`](./zapo/use-with-ai.md).

### Regras de implantação relevantes (do AGENTS.md)

- O Zapo Manager usa **locks Redis** para garantir `replicas: 1` por sessão. O MCP dev **não** substitui esse mecanismo — ele é uma ferramenta de inspeção/debug, não de gerenciamento de sessão.
- O **Strict Proxy Enforcement** continua ativo mesmo quando o agente aciona a conexão via MCP. Se a instância tiver proxy configurado com `enabled: true` e o proxy falhar, a conexão é abortada — o agente não consegue contornar essa proteção.

---

## 📚 Referências

| Recurso | URL |
|---|---|
| Documentação Zapo (web) | https://zapo.to |
| Docs MCP endpoint | https://zapo.to/mcp |
| Índice llms.txt | https://zapo.to/llms.txt |
| Corpus llms-full.txt | https://zapo.to/llms-full.txt |
| npm @zapo-js/mcp-server | https://www.npmjs.com/package/@zapo-js/mcp-server |
| Model Context Protocol spec | https://modelcontextprotocol.io |
| OpenAPI schema (local) | [docs/openapi.yaml](./openapi.yaml) |
| Guia Zapo × IA (oficial) | [docs/zapo/use-with-ai.md](./zapo/use-with-ai.md) |
| Ferramentas dev MCP/Fake | [docs/zapo/dev-tools.md](./zapo/dev-tools.md) |
