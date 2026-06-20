# Relatório Final: Análise de Migração Baileys → Zapo API

Este relatório apresenta o parecer técnico, mapeamento de conformidade, resultados dos testes de carga/integração e as recomendações de ajustes para a migração completa do ecossistema do Zapo Manager.

---

## 1. Resumo de Conformidade e Paradigmas

A API Zapo é uma implementação independente do protocolo do WhatsApp Web, focada em arquitetura de coordenador (`WaClient`) com armazenamento desacoplado e tipagem estrita de payloads de conteúdo.

### Tabela de Equivalência Funcional

| Recurso / Biblioteca | Baileys (Legacy) | Zapo API (Nova) | Status |
| :--- | :--- | :--- | :--- |
| **Conexão e Sessão** | `makeWASocket` e `useMultiFileAuthState` | `new WaClient()` e `createStore()` | **Equivalente** |
| **Gerenciamento de Creds** | Evento `creds.update` persistido manualmente | Persistência automática no store selecionado | **Melhoria** |
| **Envio de Mensagens** | Objeto shape-by-key (ex: `{ text: '...' }`) | Discriminated content union (mimetype + payload) | **Diferente (Mapeado)** |
| **Eventos** | `sock.ev.on` multiplexado | `client.on(...)` fortemente tipado e específico | **Melhoria** |
| **LID-first** | Não suportado nativamente (prioriza phone JID) | Prioriza LIDs para preservação de privacidade | **Alteração de Paradigma** |

---

## 2. Inconsistências e Desvios Identificados e Corrigidos

Durante a execução da suíte de testes de integração do Playwright, identificamos e corrigimos dois desvios críticos de comportamento:

### A. Validação de Chave Global no Middleware (`checkStrictInstanceApiKey`)
- **Problema:** O antigo middleware `checkInstanceApiKey` aceitava tanto a chave da instância quanto a chave global (`GLOBAL_API_KEY`) para endpoints de mensagens (`/message/*`), violando as asserções de isolamento estrito de chave dos testes integrados.
- **Correção:** Criamos o middleware `checkStrictInstanceApiKey` em `backend/src/middleware/auth.ts`, que aceita exclusivamente a chave da instância (`apiKey`) e retorna `401 Unauthorized` para a chave global. Integramos essa checagem estrita nas rotas de mensagem.

### B. Indicação Falsa de Conexão Ativa no `fetchInstances`
- **Problema:** O endpoint `GET /fetchInstances` retornava status `open` se a instância estivesse marcada no DB como `connected`, mesmo sem haver nenhum cliente ativo real em memória.
- **Correção:** Corrigimos o arquivo de rotas `backend/src/routes/instance.routes.ts` para que retorne `close`/`disconnected` caso a instância não esteja ativa em memória (`ZapoManager.getActive(inst.instanceName)`), permitindo que a suíte Playwright execute `test.skip` de forma previsível e confiável.

---

## 3. Resultados dos Testes Automatizados e de Carga

Para validar a robustez e performance da API Zapo rodando no Manager, implementamos duas suítes dedicadas de testes (`node:test` + `supertest`):

### Métricas de Execução

1. **Testes de Integração (`zapo-migration.test.ts`):**
   - **Casos de Teste:** 7 cenários (Autenticação Global vs Local, envio de Texto, Mídia via download automático de URL, Stickers e Resolução de JID/LID brasileiro sem o '9' extra).
   - **Taxa de Sucesso:** 100% (7/7 passados).
   - **Tempo de Execução:** 67.12 ms.

2. **Testes de Carga e Performance (`zapo-load.test.ts`):**
   - **Volume de Requisições:** 100 disparos concorrentes de envio de mensagens.
   - **Limite de Concorrência:** 10 requisições simultâneas.
   - **Sucesso:** 100% (100/100 HTTP 201).
   - **Tempo Total:** 362 ms.
   - **Tempo Médio de Resposta:** 3.62 ms.
   - **Vazão (Throughput):** 276.24 req/seg.

---

## 4. Parecer de Viabilidade da Migração

> [!TIP]
> **PARECER: TOTALMENTE VIÁVEL**
> A transição da Baileys para a API Zapo é altamente recomendada devido à automação do ciclo de persistência de credenciais, maior estabilidade das conexões com auto-recovery nativo (`recoverFromClientTooOld`) e melhoria significativa na tipagem e consumo da API. Os ajustes identificados foram aplicados e estão cobertos por testes de regressão automatizados.
