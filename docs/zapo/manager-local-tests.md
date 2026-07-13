# Estrutura local de testes do Zapo Manager

Esta estrutura separa tres camadas para validar o Manager sem misturar testes seguros com envios reais de WhatsApp.

## Camadas

| Camada | Comando | O que valida |
|---|---|---|
| API offline | `npm run test:manager:api` | Endpoints Express, auth, configuracoes, webhook, proxy, chat, contato, companions/e-mail e payloads interativos ate o estado desconectado |
| UI mockada | `npm run test:manager:ui` | Botoes e funcoes visiveis do frontend com API mockada no Playwright |
| Smoke real opt-in | `npm run test:smoke:real` | Fluxos reais ja existentes, usando uma instancia conectada quando configurada |

## Skill BMAD local

A skill local `.agents/skills/zapo-manager-test-runner` encapsula este gate para agentes BMAD/Codex. Use quando a tarefa for rodar ou validar os testes locais do Manager sem relembrar comandos manualmente.

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/zapo-manager-test-runner/scripts/run-manager-tests.ps1 -Mode all
```

Modos aceitos: `api`, `ui`, `all` e `real`. O modo `real` continua opt-in e deve ser usado apenas com uma instancia de teste conectada.

## Arquivos

- `tests/helpers/manager-fixtures.ts`: fixtures compartilhadas, payloads interativos, mock de API do frontend.
- `tests/zapo-manager-endpoints.spec.ts`: contrato executavel dos endpoints offline-safe.
- `tests/zapo-manager-ui.spec.ts`: smoke dos botoes/funcoes do Manager com API mockada.
- `playwright.manager-ui.config.ts`: sobe apenas o Vite frontend em `127.0.0.1:5173`.

## Como rodar

```powershell
npm run test:manager:api
npm run test:manager:ui
npm run test:manager
```

Para testes reais de envio, conecte uma instancia e use os comandos opt-in ja existentes. A suite nova nao envia mensagens reais: nas rotas de mensagem ela valida auth/payload e espera `503` quando a instancia esta desconectada; na UI, o backend e mockado.

## Relacao com os dev tools do Zapo

Os docs `docs/zapo/use-with-ai.md` e `docs/zapo/dev-tools.md` descrevem dois recursos complementares:

- Docs MCP (`https://zapo.to/mcp`) para agentes consultarem a documentacao atual.
- `@zapo-js/fake-server` para testes de protocolo WhatsApp offline com `WaClient` real.

A estrutura acima cobre o Manager local. Quando precisarmos validar handshake, pairing, Signal, media upload/download ou eventos reais do `WaClient` sem WhatsApp externo, a proxima camada deve ser uma suite dedicada com `@zapo-js/fake-server` no backend, separada dos testes de contrato HTTP/UI.
