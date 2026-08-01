# Plano: sinais operacionais na dashboard da instancia

Data: 2026-08-01

## Objetivo

Exibir na dashboard da instancia os sinais que o backend do Zapo Manager ja possui ou consegue derivar com baixo risco: contatos reais, persistencia de historico, chats persistidos, ultima atividade, relacao memoria/banco, proxy, conexao e alertas mobile.

O foco e entregar visibilidade operacional sem introduzir Grafana, Loki, Novu ou outro stack externo nesta primeira etapa.

## Status de implementacao

Atualizado em 2026-08-01:
- Fase 0 implementada: helper Telegram global por env vars criado, com deduplicacao, timeout e falha nao bloqueante.
- Fase 1 implementada sem migration: `/instance/fetchInstances` retorna `operational`, `_count.Contact` usa contagem real tolerante, e a dashboard exibe os sinais em componente local.
- Fase 2 item 7 implementado: `GET /instance/runtime-stats/:instanceName` retorna contagens de memoria vs banco sem expor JIDs e a dashboard exibe o diagnostico.
- Fase 3 base implementada: eventos persistentes `InstanceEvent`, lido/nao lido, endpoints de leitura e painel de eventos recentes na dashboard.

## Checklist de implementacao

### Fase 0 - Telegram simples por env vars

- [x] Criar helper backend isolado para Telegram.
- [x] Configurar `TELEGRAM_ALERTS_ENABLED`, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.
- [x] Garantir timeout e falha nao bloqueante.
- [x] Aplicar deduplicacao simples por evento/instancia.
- [x] Enviar alertas para proxy fail, takeover, codigo de registro e desconexao.
- [x] Adicionar teste unitario isolado para helper Telegram com mock de `fetch`.
- [x] Adicionar opcional `TELEGRAM_ALERT_DEDUPE_SECONDS`.
- [x] Definir se desconexao deve continuar enviando Telegram por padrao ou ficar atras de flag especifica.

### Fase 1 - Dashboard sem schema novo

- [x] Contar contatos reais sem quebrar quando a tabela da store nao existir.
- [x] Manter `_count` compativel com frontend atual.
- [x] Adicionar namespace aditivo `operational` em `/instance/fetchInstances`.
- [x] Exibir contatos, chats, mensagens, ultima atividade, historico e conexao na dashboard.
- [x] Isolar UI nova em componente local para reduzir conflitos com subtree do Evolution Manager.
- [x] Cobrir contrato backend na suite API offline.
- [x] Cobrir renderizacao principal na UI mockada.
- [x] Adicionar cobertura para estado `historyPersistence.mode=memory` na UI mockada.
- [x] Adicionar cobertura para `proxyHealth.severity=critical` na UI mockada.

### Fase 2 - Diagnostico tecnico

- [x] Criar `GET /instance/runtime-stats/:instanceName` autenticado.
- [x] Retornar somente contagens, sem JIDs.
- [x] Exibir diagnostico memoria vs banco na dashboard ou aba tecnica.
- [x] Adicionar query frontend para runtime stats.
- [x] Cobrir endpoint sem auth/instancia errada quando houver fixture adequada.

### Fase 3 - Eventos persistentes

- [x] Criar model/migration `InstanceEvent`.
- [x] Persistir alertas mobile criticos.
- [x] Persistir proxy fail e desconexoes relevantes.
- [x] Criar endpoints listar/marcar como lido.
- [x] Exibir ultimos eventos criticos na dashboard.
- [x] Evoluir Telegram global para canais configuraveis.

## Achados e decisoes

- `wa_mailbox_contacts` e `mailbox_contacts` pertencem a store do `zapo-js`; toda leitura deve tolerar tabela ausente e retornar `0`/lista vazia.
- `_count.Contact`, `_count.Chat` e `_count.Message` continuam como contrato de compatibilidade.
- Campos novos ficam sob `operational` para reduzir conflito com futuras mudancas do Evolution Manager.
- A UI nova deve ficar em componentes locais da dashboard, nao em componentes compartilhados do upstream.
- O smoke fake pode falhar se o backend ja estiver rodando sem runtime file do FakeWaServer; nesse caso o erro esperado e ausencia de QR fake, nao necessariamente regressao da feature.
- Telegram nao deve ser testado contra API externa nos gates padrao.
- `InstanceEvent` foi criado como tabela local `wa_instance_events`, sem relacao Prisma obrigatoria com `Instance`, para manter delecao e sync upstream simples nesta primeira versao.
- O painel de eventos recentes exibe uma lista curta e acao "Marcar lido"; detalhes tecnicos ficam em JSON para uso futuro, nao como log bruto na dashboard.
- Retencao inicial definida por `INSTANCE_EVENTS_RETENTION_DAYS`, padrao 30 dias; valor `0` desativa a limpeza automatica.
- Canal Telegram por instancia foi criado em `wa_notification_channels`; quando houver canal habilitado ele tem prioridade sobre o fallback global por `.env`.
- Configuracao de canal mascara `botToken` nas respostas da API.
- Configuracao do Telegram foi movida para submenu de Configuracoes (`/notifications`), no estilo da pagina Proxy; dashboard fica focada em sinais, eventos e resumo.
- Configuracoes > Notificacoes agora explica quando o Telegram envia mensagens: alertas automaticos para proxy fail, takeover mobile e codigo de registro; resumo operacional somente por acao manual; desconexoes apenas com `TELEGRAM_ALERT_CONNECTION_EVENTS=true`; canal por instancia com prioridade sobre fallback global.
- Adicionado resumo operacional de eventos dos ultimos 7 dias (`events-summary`) com totais por severidade, nao lidos, tipos principais e ultimo critico.
- O card "Resumo de eventos" permanece visivel na dashboard mesmo sem eventos recentes; nesse estado o botao "Enviar resumo" fica desabilitado ate existir algo para relatar.
- Adicionado envio manual do resumo operacional por Telegram via `POST /instance/events-summary/:instanceName/send`, usando canal da instancia ou fallback global.
- Motivos de proxy consolidados para uso operacional: `proxy_auth_407`, `proxy_payment_402`, `proxy_timeout`, `proxy_config_incomplete` e `proxy_failed`; a dashboard exibe label amigavel mantendo o codigo tecnico.
- Banners mobile criticos foram isolados em componente local da dashboard para reduzir risco em futuros syncs do frontend upstream.
- Dashboard da instancia agora separa "Visao geral" e "Diagnostico"; dados tecnicos de runtime, proxy status e detalhes internos ficam na aba Diagnostico.
- Visao geral da dashboard inclui card executivo "Proxy" com estado Desativado, Conectado, Falhou ou Verificando; o painel detalhado de teste do proxy permanece em Diagnostico.
- Modal de QR Code agora renderiza tambem o QR bruto retornado em `code` por `/instance/connect`, alem do formato antigo `base64`.
- Configuracoes > Notificacoes inclui botao "Enviar teste" para validar o canal Telegram salvo da instancia.

## Anotacoes abertas

- [x] Avaliar se o painel tecnico deve ficar sempre visivel ou escondido em uma aba "Diagnostico".
- [x] Definir politica de retencao antes de ampliar persistencia de eventos/logs.
- [x] Definir nomenclatura final dos motivos de proxy (`proxy_auth_407`, `proxy_payment_402`, `proxy_timeout`, etc.) antes de usar em relatorios.
- [x] Planejar isolamento maior dos banners mobile em componente local dedicado.
- [ ] Validar em producao se `wa_mailbox_contacts.session_id` sempre usa `instanceName` como chave.

### Runbook: validar chave de contatos em producao

Objetivo:
- Confirmar se a store PostgreSQL do `zapo-js` grava `wa_mailbox_contacts.session_id` com o mesmo valor usado pelo Manager em `Instance.name`.
- Evitar que a dashboard mostre `0` contatos por divergencia de chave, mesmo quando a store possui contatos.

Consulta segura de amostragem:

```sql
SELECT
  i."name" AS instance_name,
  COUNT(c.*) AS contacts_by_instance_name
FROM "Instance" i
LEFT JOIN "wa_mailbox_contacts" c
  ON c."session_id" = i."name"
GROUP BY i."name"
ORDER BY contacts_by_instance_name DESC, i."name"
LIMIT 20;
```

Consulta para detectar chaves sem instancia correspondente:

```sql
SELECT
  c."session_id",
  COUNT(*) AS contacts
FROM "wa_mailbox_contacts" c
LEFT JOIN "Instance" i
  ON i."name" = c."session_id"
WHERE i."name" IS NULL
GROUP BY c."session_id"
ORDER BY contacts DESC
LIMIT 20;
```

Criterios:
- Se a primeira consulta retorna contatos para instancias conhecidas e a segunda nao mostra chaves relevantes, manter a implementacao atual.
- Se a segunda consulta mostrar chaves reais diferentes de `Instance.name`, registrar exemplos anonimizados e avaliar fallback controlado por configuracao antes de alterar a dashboard.
- Nao expor JIDs, telefones ou nomes de contatos no relatorio de validacao; usar apenas contagens e chaves de sessao anonimizadas quando necessario.

## Escopo inicial

### 1. Contador real de contatos

Estado atual:
- `GET /instance/fetchInstances` retorna `_count.Contact = 0`.
- `GET /contact/find/:instanceName` ja busca contatos em `wa_mailbox_contacts` no Postgres ou `mailbox_contacts` no SQLite.

Implementacao:
- Criar helper backend para contar contatos por instancia usando a mesma origem de `/contact/find`.
- Integrar esse count em `/instance/fetchInstances`.
- Tratar tabela ausente como `0`, sem derrubar a rota.

Arquivos provaveis:
- `backend/src/routes/contact.routes.ts`
- `backend/src/routes/instance.routes.ts`
- possivel novo helper em `backend/src/services/contactStats.ts`

Aceite:
- Dashboard deixa de mostrar sempre `0` quando contatos existem na store.
- Suite API cobre Postgres/tabela ausente ou mock equivalente.

### 2. Status de persistencia de mensagens

Estado atual:
- Mensagens so persistem em `wa_messages` quando `SAVE_DATA_NEW_MESSAGE=true`.
- Caso contrario, a tela usa apenas cache em memoria e perde historico no restart.

Implementacao:
- Expor em `/instance/fetchInstances` um campo operacional, por exemplo:
  - `historyPersistence.mode`: `database` ou `memory`
  - `historyPersistence.messagesEnabled`: boolean
  - `historyPersistence.warning`: string opcional
- Renderizar badge/card compacto na dashboard.

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `frontend/src/lib/queries/instance/types.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Usuario ve claramente se o historico de mensagens sobrevive a restart.
- UI nao bloqueia operacao quando estiver em modo memoria.

### 3. Chats persistidos e qualidade da lista

Estado atual:
- `wa_chats` e atualizada em `ZapoManager.storeMessage()` via `prisma.chatEntry.upsert`.
- `ZapoManager.getChatList()` combina banco + cache em memoria.

Implementacao:
- Expor dados resumidos em `/instance/fetchInstances`:
  - `chatStats.total`
  - `chatStats.lastUpdatedAt`
  - `chatStats.lastRemoteJid` opcional
- Dashboard mostra total e ultima atualizacao.

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Card de chats informa total e ultima atividade de chat.
- Sem chats, mostra estado vazio claro.

### 4. Ultima mensagem / ultima atividade

Estado atual:
- `ChatEntry.updatedAt` muda quando uma mensagem atualiza o chat.
- `Message.createdAt` e `messageTimestamp` existem quando persistencia esta ativa.

Implementacao:
- Derivar `lastActivityAt` primeiro de `wa_chats.updatedAt`.
- Se necessario, complementar com `wa_messages.createdAt` quando `SAVE_DATA_NEW_MESSAGE=true`.
- Mostrar "Ultima atividade" na dashboard.

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Instancia com mensagens recentes exibe timestamp relativo ou data/hora.
- Instancia sem atividade exibe "Sem atividade registrada".

### 5. Mensagens em memoria vs banco

Estado atual:
- `ZapoManager.debugState()` ja consegue retornar quantidades em memoria por JID.
- `wa_messages` so tem dados se `SAVE_DATA_NEW_MESSAGE=true`.

Implementacao:
- Criar endpoint operacional autenticado, por exemplo:
  - `GET /instance/runtime-stats/:instanceName`
- Retornar:
  - `memoryChats`
  - `memoryMessages`
  - `databaseMessages`
  - `databaseEnabled`
- Usar na dashboard como painel tecnico discreto ou aba "Diagnostico".

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `backend/src/manager.ts`
- `frontend/src/lib/queries/instance/runtimeStats.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Operador consegue entender divergencia entre dados em memoria e persistidos.
- Endpoint exige API key da instancia ou global key.

### 6. Status e notificacao de proxy

Estado atual:
- `/instance/fetchInstances` ja retorna `proxyEnabled`, `proxyConnected` e `proxyError`.
- Dashboard ja renderiza alerta visual quando `proxyConnected === false`.

Implementacao:
- Padronizar severidade:
  - `ok`
  - `warning`
  - `critical`
- Derivar motivo conhecido de `proxyError`: 407, 402, timeout, host ausente.
- Persistir opcionalmente como evento operacional numa tabela futura.
- Nesta fase, melhorar card/status e texto de acao.

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`
- `frontend/src/pages/instance/Proxy/index.tsx`

Aceite:
- Falhas 407/402/timeout aparecem com causa amigavel.
- Instancia com proxy obrigatorio e falha fica visualmente critica.

### 7. Status de conexao mais rico

Estado atual:
- Dashboard usa `connectionStatus`: `open`, `connecting`, `close`.
- Backend calcula estado a partir de `active.client.getState()`, registro e QR pendente.

Implementacao:
- Expor detalhe operacional adicional:
  - `connectionDetails.registered`
  - `connectionDetails.hasActiveClient`
  - `connectionDetails.hasQrCode`
  - `connectionDetails.ownerJid`
  - `connectionDetails.lastKnownStatus`
- Renderizar substatus:
  - Conectada
  - Aguardando QR/pareamento
  - Desconectada
  - Cliente ativo sem registro completo

Arquivos provaveis:
- `backend/src/routes/instance.routes.ts`
- `frontend/src/components/instance-status.tsx`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Operador entende por que a instancia esta `close` ou `connecting`.
- Nao expor segredos ou material de auth.

### 8. Alertas de seguranca mobile persistiveis

Estado atual:
- `mobile_registration_code` e `mobile_account_takeover_notice` ja viram banners em tempo real via Socket.io.
- Ao recarregar a pagina, o alerta temporario desaparece.

Implementacao:
- Criar modelo minimo de evento operacional:
  - `InstanceEvent`
  - `instanceName`
  - `type`
  - `severity`
  - `title`
  - `payload`
  - `readAt`
  - `createdAt`
- Persistir eventos criticos mobile quando recebidos.
- Expor endpoint para listar/marcar como lido.
- Dashboard mostra ultimos eventos criticos.

Arquivos provaveis:
- `backend/prisma/schema.prisma`
- nova migration Prisma
- `backend/src/manager.ts`
- `backend/src/routes/instance.routes.ts` ou nova `event.routes.ts`
- `frontend/src/pages/instance/DashboardInstance/index.tsx`

Aceite:
- Alertas de takeover/codigo ficam registrados apos refresh.
- Usuario consegue marcar como lido.
- Eventos criticos continuam chegando em tempo real por Socket.io.

## Ordem de implementacao recomendada

### Fase 1 - Baixo risco, sem schema novo

1. Contador real de contatos.
2. Status de persistencia de mensagens.
3. Chats persistidos com ultima atualizacao.
4. Ultima atividade.
5. Melhorar status de proxy.
6. Enriquecer status de conexao.

Motivo:
- Usa tabelas e campos ja existentes.
- Evita migration no primeiro pacote.
- Entrega valor rapido na dashboard.

### Fase 2 - Diagnostico tecnico

7. Mensagens em memoria vs banco.

Motivo:
- Exige endpoint novo e cuidado para nao expor debug sensivel.
- Melhor posicionar como painel tecnico/diagnostico.

### Fase 3 - Eventos persistentes

8. Alertas mobile persistiveis.

Motivo:
- Requer schema/migration, API de leitura e estado de lido.
- E a base futura para central de notificacoes, relatorios e canais externos.

### Fase 0 opcional - Telegram simples por env vars

Implementar uma primeira notificacao externa por Telegram antes da central completa de eventos.

Escopo:
- Criar helper backend isolado para enviar mensagem pela Telegram Bot API.
- Configurar por variaveis de ambiente globais:
  - `TELEGRAM_ALERTS_ENABLED=true`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
- Enviar somente eventos criticos de baixo volume no primeiro momento:
  - proxy falhou em instancia com proxy habilitado
  - takeover mobile detectado
  - codigo de registro mobile recebido
  - instancia desconectou, se nao gerar ruido excessivo

Arquivos provaveis:
- `backend/src/services/telegramAlerts.ts`
- `backend/src/manager.ts`
- `backend/src/routes/config.routes.ts`
- `backend/src/routes/instance.routes.ts`
- `.env.example`
- `docs/DOCKER.md`

Aceite:
- Com env vars ausentes ou `TELEGRAM_ALERTS_ENABLED` diferente de `true`, nenhum envio externo e feito.
- Erro no Telegram nunca derruba fluxo principal de conexao, proxy, webhook ou mensagem.
- Token do bot nunca aparece em logs.
- Mensagem enviada contem instancia, severidade, tipo do evento e resumo acionavel.

Cuidados:
- Aplicar deduplicacao simples por chave/evento em memoria, por exemplo janela de 5 a 10 minutos, para evitar spam em loop de reconnect.
- Manter timeout curto na chamada HTTP.
- Nao enviar payload bruto de mensagem, token de instancia, senha de proxy ou dados de auth.
- Tratar essa fase como canal global temporario; configuracao por instancia/canal entra depois com `InstanceEvent` e `NotificationChannel`.

## Testes

Backend:
- `npm --prefix backend run build`
- Testes API offline em `tests/zapo-manager-endpoints.spec.ts`
- Testes especificos para contagem de contatos e stats de instancia.

Frontend:
- `npm run build:frontend` ou gate equivalente do repo.
- `npm run test:manager:ui`
- Quando houver mudanca visivel na dashboard real: `npm run test:manager:ui:real`

Fake/smoke:
- Usar `npm run test:manager:smoke:fake` apenas se a alteracao tocar fluxo real de eventos do `WaClient`.

## Riscos e cuidados

- Contatos vem de tabelas da store do zapo-js, nao de model Prisma versionado; falha de tabela deve ser tolerada.
- `wa_messages` pode crescer muito se persistencia estiver ativa sem retencao.
- Nao exibir payloads sensiveis de auth, tokens, proxy password ou dados completos de mensagem em cards.
- Evitar transformar a dashboard em tela de logs; eventos detalhados devem ir para uma aba dedicada.
- Manter o frontend minimalista para preservar facilidade de sync com upstream.

## Cuidados para manter compatibilidade com upstream

O projeto depende de dois upstreams independentes:
- `evolution-foundation/evolution-manager-v2`, integrado por `git subtree` em `frontend/`.
- `vinikjkkj/zapo`/`zapo-js`, consumido por pacotes npm no backend.

As personalizacoes deste plano devem ser desenhadas para sobreviver a atualizacoes desses mantenedores.

### Fronteira de customizacao

- Concentrar a regra operacional no backend do Zapo Manager, nao no frontend importado do Evolution Manager.
- Preferir campos derivados em `/instance/fetchInstances` e endpoints proprios do backend local em vez de alterar profundamente queries ou componentes upstream.
- Quando a UI precisar mudar, isolar os novos blocos em componentes locais pequenos, por exemplo:
  - `InstanceOperationalStatusPanel`
  - `InstanceActivityStats`
  - `InstanceEventsPanel`
- Evitar alterar componentes compartilhados do upstream quando um componente local renderizado na dashboard resolver.
- Manter tipos locais tolerantes a campos opcionais para que o frontend continue funcionando se o backend antigo ou novo nao retornar algum campo operacional.

### Contrato de API local

Campos novos em `/instance/fetchInstances` devem ser aditivos e opcionais:

```ts
operational?: {
  contactCount?: number
  historyPersistence?: {
    mode: 'database' | 'memory'
    messagesEnabled: boolean
  }
  chatStats?: {
    total: number
    lastUpdatedAt?: string | null
    lastRemoteJid?: string | null
  }
  lastActivityAt?: string | null
  proxyHealth?: {
    severity: 'ok' | 'warning' | 'critical'
    reason?: string | null
  }
  connectionDetails?: {
    registered: boolean
    hasActiveClient: boolean
    hasQrCode: boolean
    lastKnownStatus?: string | null
  }
}
```

Cuidados:
- Nao substituir `_count` abruptamente; manter `_count.Contact`, `_count.Chat` e `_count.Message` para compatibilidade com a UI existente.
- Usar `operational` como namespace local para reduzir conflito com nomes futuros do Evolution Manager.
- Nao expor segredos, payload bruto de mensagem, token de instancia, senha de proxy ou material de auth.

### Atualizacoes do Evolution Manager v2

Antes de `git subtree pull --prefix=frontend upstream-frontend main --squash`:
- Rodar a triagem documentada em `docs/SYNC-UPSTREAM.md`.
- Verificar se o upstream alterou:
  - `frontend/src/pages/instance/DashboardInstance/index.tsx`
  - `frontend/src/components/instance-status.tsx`
  - `frontend/src/lib/queries/instance/fetchInstance.ts`
  - `frontend/src/lib/queries/instance/types.ts`
  - rotas/layout de instancia.

Durante conflitos:
- Preservar imports e renderizacao dos componentes locais de sinais operacionais.
- Evitar resolver conflito descartando campos locais de `Instance`.
- Se o upstream reestruturar a dashboard, mover os componentes locais para o novo ponto de extensao em vez de recriar a UI antiga.

Depois do sync:
- Confirmar que a dashboard ainda renderiza:
  - contadores
  - ultima atividade
  - status de persistencia
  - status de proxy
  - status detalhado de conexao
  - alertas mobile persistiveis, se ja implementados.

### Atualizacoes de zapo-js

Antes de atualizar `zapo-js` ou stores:
- Rodar `node scripts/zapo-release-triage.mjs --mode zapo --evolution-api` com a tag nova.
- Revisar mudancas em eventos, payloads, stores e nomes de tabelas internas.
- Conferir impacto nos pontos locais:
  - `backend/src/manager.ts`
  - `backend/src/routes/chat.routes.ts`
  - `backend/src/routes/contact.routes.ts`
  - `backend/src/routes/instance.routes.ts`
  - `backend/prisma/schema.prisma`

Cuidados especificos:
- `wa_mailbox_contacts`, `wa_chats` e `wa_messages` nao devem ser assumidas como contrato eterno do upstream sem fallback.
- Qualquer query direta em tabela interna da store deve falhar fechado para `0` ou lista vazia, com log de aviso.
- Eventos de mensagem devem continuar passando por normalizacao local antes de alimentar dashboard, webhook ou Socket.io.
- Se o upstream mudar nomes de eventos mobile ou payloads, criar adaptador local em `manager.ts` em vez de espalhar condicionais no frontend.

### Testes obrigatorios apos update de upstream

Backend:
- `npm --prefix backend run build`
- `npm run test:manager:api`

Frontend:
- `npm run build:frontend` ou `npm run build:all`
- `npm run test:manager:ui`

Quando a dashboard ou rotas reais forem afetadas:
- `npm run test:manager:ui:real`

Quando eventos do `WaClient` ou persistencia forem afetados:
- `npm run test:manager:smoke:fake`

### Regra de manutencao

Toda nova personalizacao deste plano deve responder duas perguntas antes de entrar:
- Ela esta isolada em backend/adapter/componente local, ou altera uma area que o subtree do Evolution Manager provavelmente vai sobrescrever?
- Ela depende de tabela/evento interno do `zapo-js`; se sim, existe fallback tolerante quando o upstream mudar?

## Proxima decisao

Definir se a proxima evolucao deve ser envio agendado do resumo por e-mail/Telegram ou uma central dedicada de notificacoes fora da dashboard.
