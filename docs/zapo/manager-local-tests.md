# Estrutura local de testes do Zapo Manager

Esta estrutura separa tres camadas para validar o Manager sem misturar testes seguros com envios reais de WhatsApp.

## Camadas

| Camada | Comando | O que valida |
|---|---|---|
| API offline | `npm run test:manager:api` | Endpoints Express, auth, configuracoes, webhook, proxy, chat, contato, companions/e-mail e payloads interativos ate o estado desconectado |
| UI mockada | `npm run test:manager:ui` | Botoes e funcoes visiveis do frontend com API mockada no Playwright |
| UI real, backend real | `npm run test:manager:ui:real` | Navegacao real do frontend contra Express/Prisma/Postgres/Redis sem mock de rede, sem dependere de WhatsApp conectado |
| Smoke real opt-in | `npm run test:smoke:real` | Fluxos reais ja existentes, usando uma instancia conectada quando configurada |

## Skill BMAD local

A skill local `.agents/skills/zapo-manager-test-runner` encapsula este gate para agentes BMAD/Codex. Use quando a tarefa for rodar ou validar os testes locais do Manager sem relembrar comandos manualmente.

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/zapo-manager-test-runner/scripts/run-manager-tests.ps1 -Mode all
```

Modos aceitos: `api`, `ui`, `ui-real`, `all` e `real`. O modo `ui-real` usa backend real visivel em terminal proprio; o modo `real` continua opt-in e deve ser usado apenas com uma instancia de teste conectada.

## Arquivos

- `tests/helpers/manager-fixtures.ts`: fixtures compartilhadas, payloads interativos, mock de API do frontend.
- `tests/zapo-manager-endpoints.spec.ts`: contrato executavel dos endpoints offline-safe.
- `tests/zapo-manager-ui.spec.ts`: smoke dos botoes/funcoes do Manager com API mockada.
- `tests/playwright/manager-ui.config.ts`: sobe apenas o Vite frontend em `127.0.0.1:5173`.

## Como rodar

```powershell
npm run test:manager:api
npm run test:manager:ui
npm run test:manager
```

Para testes reais de envio, conecte uma instancia e use os comandos opt-in ja existentes. A suite de UI real nao envia mensagens reais nem abre QR code de pareamento; ela valida login, dashboard, criacao de instancia, navegacao entre abas, idioma e persistencia de settings/webhook contra o backend real.

### UI real contra backend real

Essa quarta camada existe para cobrir o contrato visivel do Manager sem mockar HTTP.

Requisitos:
- Backend Express rodando em `http://127.0.0.1:8080`
- Frontend rodando em `http://127.0.0.1:5173`
- Postgres e Redis ja iniciados fora da suite

Uso recomendado:

```powershell
npm run test:manager:ui:real
```

O backend deve ser iniciado em janela propria quando possivel, para manter logs visiveis ao desenvolvedor. A suite nao faz envio real nem depende de instancia WhatsApp conectada; se uma tela exigir conexao aberta, o teste deve pular esse ramo explicitamente.

Os configs Playwright de suporte agora ficam em `tests/playwright/`:

- `tests/playwright/manager-ui.config.ts`
- `tests/playwright/manager-ui-real.config.ts`

## Relacao com os dev tools do Zapo

Os docs `docs/zapo/use-with-ai.md` e `docs/zapo/dev-tools.md` descrevem dois recursos complementares:

- Docs MCP (`https://zapo.to/mcp`) para agentes consultarem a documentacao atual.
- `@zapo-js/fake-server` para testes de protocolo WhatsApp offline com `WaClient` real.

A estrutura acima cobre o Manager local. Quando precisarmos validar handshake, pairing, Signal, media upload/download ou eventos reais do `WaClient` sem WhatsApp externo, a proxima camada deve ser uma suite dedicada com `@zapo-js/fake-server` no backend, separada dos testes de contrato HTTP/UI.
